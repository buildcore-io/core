/* eslint-disable @typescript-eslint/no-explicit-any */

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
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty, set } from 'lodash';
import { build5Db } from '../src/firebase/firestore/build5Db';
import { WalletService } from '../src/services/wallet/wallet.service';
import { getAddress } from '../src/utils/address.utils';
import { dateToTimestamp } from '../src/utils/dateTime.utils';
import * as wallet from '../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  validateMemberAddressFunc,
  validateSpaceAddressFunc,
  wait,
} from '../test/controls/common';
import { getWallet } from '../test/set-up';
import { getTangleOrder } from './common';
import { requestFundsFromFaucet } from './faucet';

let walletSpy: any;

const awaitMemberAddressValidation = async (memberId: string, network: Network) => {
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${memberId}`);
  await wait(async () => {
    const member = <Member>await memberDocRef.get();
    return !isEmpty(getAddress(member, network));
  });
};

const awaitSpaceAddressValidation = async (space: string, network: Network) => {
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space}`);
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
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);
    await build5Db().doc(`${COL.MEMBER}/${member}`).update({ validatedAddress: {} });
  });

  const validateMemberAddress = async (network: Network, expiresAt?: Timestamp) => {
    const order = await validateMemberAddressFunc(walletSpy, member, network);
    const { faucetAddress } = await requestFundsFromFaucet(
      network,
      order.payload.targetAddress!,
      order.payload.amount!,
      expiresAt,
    );

    await awaitMemberAddressValidation(member, network);

    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${member}`);
    const data = <Member>await memberDocRef.get();
    expect(data.validatedAddress![network]).toBe(faucetAddress.bech32);
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
    const order = await validateSpaceAddressFunc(walletSpy, member, space, network);
    const { faucetAddress } = await requestFundsFromFaucet(
      network,
      order.payload.targetAddress!,
      order.payload.amount!,
    );

    await awaitSpaceAddressValidation(space, network);

    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space}`);
    const spaceData = <Space>await spaceDocRef.get();
    expect(spaceData.validatedAddress![network]).toBe(faucetAddress.bech32);
  };

  it.each([Network.ATOI, Network.RMS])(
    'Should validate space address with network',
    async (network: Network) => {
      space = (await createSpace(walletSpy, member)).uid;
      await build5Db().doc(`${COL.SPACE}/${space}`).update({ validatedAddress: {} });
      await validateSpace(network);
    },
  );

  it('Should validate space address with both network', async () => {
    space = (await createSpace(walletSpy, member)).uid;
    await build5Db().doc(`${COL.SPACE}/${space}`).update({ validatedAddress: {} });
    await validateSpace(Network.ATOI);
    await validateSpace(Network.RMS);
  });

  it('Should validate rms address with expiration unlock', async () => {
    const network = Network.RMS;
    const date = dayjs().add(2, 'm').millisecond(0).toDate();
    const expiresAt = dateToTimestamp(date);

    const walletService = await getWallet(network);
    const tmpAddress = await walletService.getNewIotaAddressDetails();

    const order = await validateMemberAddressFunc(walletSpy, member, network);
    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${member}`);
    let memberData = <Member>await memberDocRef.get();

    await requestFundsFromFaucet(network, tmpAddress.bech32, order.payload.amount!);
    await walletService.send(tmpAddress, order.payload.targetAddress!, order.payload.amount!, {
      expiration: { expiresAt, returnAddressBech32: tmpAddress.bech32 },
    });

    await awaitMemberAddressValidation(member, network);

    memberData = <Member>await memberDocRef.get();
    expect(memberData.validatedAddress![network]).toBe(tmpAddress.bech32);

    const unlock = (
      await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.UNLOCK)
        .where('member', '==', member)
        .get()
    )[0] as Transaction;
    expect(dayjs(unlock.payload.expiresOn!.toDate()).isSame(dayjs(expiresAt.toDate()))).toBe(true);

    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', member)
        .get<Transaction>();
      return snap.length === 1 && snap[0].payload?.walletReference?.confirmed;
    });

    const balanace = await walletService.getBalance(tmpAddress.bech32);
    expect(balanace).toBe(order.payload.amount);
  });

  it.each([
    { network: Network.RMS, validateSpace: true },
    { network: Network.RMS, validateSpace: false },
    { network: Network.ATOI, validateSpace: true },
    { network: Network.ATOI, validateSpace: false },
  ])('Should validate address with tangle request', async ({ network, validateSpace }) => {
    tangleOrder = await getTangleOrder(network);
    const wallet = await WalletService.newWallet(network);
    const tmp = await wallet.getNewIotaAddressDetails();

    await build5Db()
      .doc(`${COL.MEMBER}/${member}`)
      .set({ validatedAddress: { [network]: tmp.bech32 } }, true);

    if (validateSpace) {
      space = (await createSpace(walletSpy, member)).uid;
      await build5Db().doc(`${COL.SPACE}/${space}`).update({ validatedAddress: {} });
    }
    await requestFundsFromFaucet(network, tmp.bech32, 5 * MIN_IOTA_AMOUNT);

    const request = {
      requestType: TangleRequestType.ADDRESS_VALIDATION,
    };
    validateSpace && set(request, 'space', space);
    await wallet.send(tmp, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: { request },
    });

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', member);

    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length > 0 && snap[0]?.payload?.walletReference?.confirmed;
    });

    if (validateSpace) {
      const spaceData = <Space>await build5Db().doc(`${COL.SPACE}/${space}`).get();
      expect(spaceData.validatedAddress![network]).toBe(tmp.bech32);
    } else {
      const memberData = <Member>await build5Db().doc(`${COL.MEMBER}/${member}`).get();
      expect(memberData.validatedAddress![network]).toBe(tmp.bech32);
      expect(memberData.prevValidatedAddresses).toEqual([tmp.bech32]);
    }

    const snap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('payload.type', '==', TransactionPayloadType.TANGLE_TRANSFER)
      .get();
    expect(snap.length).toBe(1);
  });
});
