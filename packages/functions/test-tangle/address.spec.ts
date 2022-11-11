/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  Member,
  Network,
  Space,
  Timestamp,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import admin from '../src/admin.config';
import { getAddress } from '../src/utils/address.utils';
import * as wallet from '../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  validateMemberAddressFunc,
  validateSpaceAddressFunc,
  wait,
} from '../test/controls/common';
import { getWallet } from '../test/set-up';
import { requestFundsFromFaucet } from './faucet';

let walletSpy: any;

const awaitMemberAddressValidation = async (memberId: string, network: Network) => {
  const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${memberId}`);
  await wait(async () => {
    const member = <Member>(await memberDocRef.get()).data();
    return !isEmpty(getAddress(member, network));
  });
};

const awaitSpaceAddressValidation = async (space: string, network: Network) => {
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space}`);
  await wait(async () => {
    const space = <Space>(await spaceDocRef.get()).data();
    return !isEmpty(getAddress(space, network));
  });
};

describe('Address validation', () => {
  let member: string;
  let space: string;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);
    await admin.firestore().doc(`${COL.MEMBER}/${member}`).update({ validatedAddress: {} });
  });

  const validateMemberAddress = async (network: Network, expiresAt?: Timestamp) => {
    const order = await validateMemberAddressFunc(walletSpy, member, network);
    const { faucetAddress } = await requestFundsFromFaucet(
      network,
      order.payload.targetAddress,
      order.payload.amount,
      expiresAt,
    );

    await awaitMemberAddressValidation(member, network);

    const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${member}`);
    const data = <Member>(await memberDocRef.get()).data();
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
      order.payload.targetAddress,
      order.payload.amount,
    );

    await awaitSpaceAddressValidation(space, network);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space}`);
    const spaceData = <Space>(await spaceDocRef.get()).data();
    expect(spaceData.validatedAddress![network]).toBe(faucetAddress.bech32);
  };

  it.each([Network.ATOI, Network.RMS])(
    'Should validate space address with network',
    async (network: Network) => {
      space = (await createSpace(walletSpy, member)).uid;
      await admin.firestore().doc(`${COL.SPACE}/${space}`).update({ validatedAddress: {} });
      await validateSpace(network);
    },
  );

  it('Should validate space address with both network', async () => {
    space = (await createSpace(walletSpy, member)).uid;
    await admin.firestore().doc(`${COL.SPACE}/${space}`).update({ validatedAddress: {} });
    await validateSpace(Network.ATOI);
    await validateSpace(Network.RMS);
  });

  it('Should validate rms address with expiration unlock', async () => {
    const network = Network.RMS;
    const date = dayjs().add(2, 'm').millisecond(0).toDate();
    const expiresAt = admin.firestore.Timestamp.fromDate(date) as Timestamp;

    const walletService = await getWallet(network);
    const tmpAddress = await walletService.getNewIotaAddressDetails();

    const order = await validateMemberAddressFunc(walletSpy, member, network);
    const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${member}`);
    let memberData = <Member>(await memberDocRef.get()).data();

    await requestFundsFromFaucet(network, tmpAddress.bech32, order.payload.amount);
    await walletService.send(tmpAddress, order.payload.targetAddress, order.payload.amount, {
      expiration: { expiresAt, returnAddressBech32: tmpAddress.bech32 },
    });

    await awaitMemberAddressValidation(member, network);

    memberData = <Member>(await memberDocRef.get()).data();
    expect(memberData.validatedAddress![network]).toBe(tmpAddress.bech32);

    const unlock = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.UNLOCK)
        .where('member', '==', member)
        .get()
    ).docs[0].data() as Transaction;
    expect(dayjs(unlock.payload.expiresOn.toDate()).isSame(dayjs(expiresAt.toDate()))).toBe(true);

    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', member)
        .get();
      return snap.size === 1 && snap.docs[0].data().payload?.walletReference?.confirmed;
    });

    const balanace = await walletService.getBalance(tmpAddress.bech32);
    expect(balanace).toBe(order.payload.amount);
  });
});
