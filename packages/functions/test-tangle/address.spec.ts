/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  Network,
  Space,
  TangleRequestType,
  Timestamp,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { isEmpty, set } from 'lodash';
import { getAddress } from '../src/utils/address.utils';
import { dateToTimestamp } from '../src/utils/dateTime.utils';
import { validateMemberAddressFunc, wait } from '../test/controls/common';
import { getWallet, mockWalletReturnValue, testEnv } from '../test/set-up';
import { getTangleOrder } from './common';
import { requestFundsFromFaucet } from './faucet';

const awaitMemberAddressValidation = async (memberId: string, network: Network) => {
  const memberDocRef = database().doc(COL.MEMBER, memberId);
  await wait(async () => {
    const member = <Member>await memberDocRef.get();
    return !isEmpty(getAddress(member, network));
  });
};

const awaitSpaceAddressValidation = async (space: string, network: Network) => {
  const spaceDocRef = database().doc(COL.SPACE, space);
  await wait(async () => {
    const space = <Space>await spaceDocRef.get();
    return !isEmpty(getAddress(space, network));
  });
};

describe('Address validation', () => {
  let member: string;
  let space: string;
  let tangleOrder: Transaction;

  beforeEach(async () => {
    member = await testEnv.createMember();
    await database()
      .doc(COL.MEMBER, member)
      .update({ smrAddress: '', rmsAddress: '', iotaAddress: '', atoiAddress: '' });
  });

  const validateMemberAddress = async (network: Network, expiresAt?: Timestamp) => {
    const order = await validateMemberAddressFunc(member, network);
    const { faucetAddress } = await requestFundsFromFaucet(
      network,
      order.payload.targetAddress!,
      order.payload.amount!,
      expiresAt,
    );

    await awaitMemberAddressValidation(member, network);

    const memberDocRef = database().doc(COL.MEMBER, member);
    const data = <Member>await memberDocRef.get();
    expect(data.validatedAddress![network]).toBe(faucetAddress.bech32);
  };

  const validateSpaceAddressFunc = async (adr: string, space: string, network?: Network) => {
    mockWalletReturnValue(adr, network ? { space, network } : { space });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.validateAddress);
    expect(order?.type).toBe(TransactionType.ORDER);
    expect(order?.payload.type).toBe(TransactionPayloadType.SPACE_ADDRESS_VALIDATION);
    return <Transaction>order;
  };

  it.each([Network.ATOI, Network.RMS])(
    'Should validate member address with network',
    async (network: Network) => {
      await validateMemberAddress(network);
    },
  );

  it('Should validate member address with both network', async () => {
    await validateMemberAddress(Network.ATOI);
    await validateMemberAddress(Network.RMS);
  });

  const validateSpace = async (network: Network) => {
    const order = await validateSpaceAddressFunc(member, space, network);
    const { faucetAddress } = await requestFundsFromFaucet(
      network,
      order.payload.targetAddress!,
      order.payload.amount!,
    );

    await awaitSpaceAddressValidation(space, network);

    const spaceDocRef = database().doc(COL.SPACE, space);
    const spaceData = <Space>await spaceDocRef.get();
    expect(spaceData.validatedAddress![network]).toBe(faucetAddress.bech32);
  };

  it.each([Network.ATOI, Network.RMS])(
    'Should validate space address with network',
    async (network: Network) => {
      space = (await testEnv.createSpace(member)).uid;
      await database()
        .doc(COL.SPACE, space)
        .update({ smrAddress: '', rmsAddress: '', iotaAddress: '', atoiAddress: '' });
      await validateSpace(network);
    },
  );

  it('Should validate space address with both network', async () => {
    space = (await testEnv.createSpace(member)).uid;
    await database()
      .doc(COL.SPACE, space)
      .update({ smrAddress: '', rmsAddress: '', iotaAddress: '', atoiAddress: '' });
    await validateSpace(Network.ATOI);
    await validateSpace(Network.RMS);
  });

  it('Should validate rms address with expiration unlock', async () => {
    const network = Network.RMS;
    const date = dayjs().add(2, 'm').millisecond(0).toDate();
    const expiresAt = dateToTimestamp(date);

    const walletService = await getWallet(network);
    const tmpAddress = await walletService.getNewIotaAddressDetails();

    const order = await validateMemberAddressFunc(member, network);
    const memberDocRef = database().doc(COL.MEMBER, member);
    let memberData = <Member>await memberDocRef.get();

    await requestFundsFromFaucet(network, tmpAddress.bech32, order.payload.amount!);
    await walletService.send(tmpAddress, order.payload.targetAddress!, order.payload.amount!, {
      expiration: { expiresAt, returnAddressBech32: tmpAddress.bech32 },
    });

    await awaitMemberAddressValidation(member, network);

    memberData = <Member>await memberDocRef.get();
    expect(memberData.validatedAddress![network]).toBe(tmpAddress.bech32);

    const unlock = (
      await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.UNLOCK)
        .where('member', '==', member)
        .get()
    )[0] as Transaction;
    expect(dayjs(unlock.payload.expiresOn!.toDate()).isSame(dayjs(expiresAt.toDate()))).toBe(true);

    await wait(async () => {
      const snap = await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', member)
        .get();
      return snap.length === 1 && snap[0].payload?.walletReference?.confirmed;
    });

    const { amount } = await walletService.getBalance(tmpAddress.bech32);
    expect(amount).toBe(order.payload.amount);
  });

  it.each([
    { network: Network.RMS, validateSpace: true },
    { network: Network.RMS, validateSpace: false },
    { network: Network.ATOI, validateSpace: true },
    { network: Network.ATOI, validateSpace: false },
  ])('Should validate address with tangle request', async ({ network, validateSpace }) => {
    tangleOrder = await getTangleOrder(network);
    const wallet = await getWallet(network);
    const tmp = await wallet.getNewIotaAddressDetails();

    await database()
      .doc(COL.MEMBER, member)
      .upsert({ [`${network}Address`]: tmp.bech32 });

    if (validateSpace) {
      space = (await testEnv.createSpace(member)).uid;
      await database()
        .doc(COL.SPACE, space)
        .update({ smrAddress: '', rmsAddress: '', iotaAddress: '', atoiAddress: '' });
    }
    await requestFundsFromFaucet(network, tmp.bech32, 5 * MIN_IOTA_AMOUNT);

    const request = {
      requestType: TangleRequestType.ADDRESS_VALIDATION,
    };
    validateSpace && set(request, 'space', space);
    await wallet.send(tmp, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: { request },
    });

    const query = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', member);

    await wait(async () => {
      const snap = await query.get();
      return snap.length > 0 && snap[0]?.payload?.walletReference?.confirmed;
    });

    if (validateSpace) {
      const spaceData = <Space>await database().doc(COL.SPACE, space).get();
      expect(spaceData.validatedAddress![network]).toBe(tmp.bech32);
    } else {
      const memberData = <Member>await database().doc(COL.MEMBER, member).get();
      expect(memberData.validatedAddress![network]).toBe(tmp.bech32);
      expect(memberData.prevValidatedAddresses).toEqual([tmp.bech32]);
    }

    const snap = await database()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('payload_type', '==', TransactionPayloadType.TANGLE_TRANSFER)
      .get();
    expect(snap.length).toBe(1);
  });
});
