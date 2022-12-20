/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  TangleRequestType,
  Timestamp,
  Transaction,
  TransactionType,
  TransactionUnlockType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty, set } from 'lodash';
import admin from '../src/admin.config';
import { IotaWallet } from '../src/services/wallet/IotaWalletService';
import { SmrWallet } from '../src/services/wallet/SmrWalletService';
import { WalletService } from '../src/services/wallet/wallet';
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
import { getRmsSoonTangleResponse, getTangleOrder } from './common';
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
  let tangleOrder: Transaction;

  beforeAll(async () => {
    tangleOrder = await getTangleOrder();
  });

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

  it.each([false, true])(
    'Should validate rms address with tangle request',
    async (validateSpace) => {
      const wallet = await WalletService.newWallet(Network.RMS);
      const tmp = await wallet.getNewIotaAddressDetails();

      if (validateSpace) {
        space = (await createSpace(walletSpy, member)).uid;
        await admin.firestore().doc(`${COL.SPACE}/${space}`).update({ validatedAddress: {} });
        await admin
          .firestore()
          .doc(`${COL.MEMBER}/${member}`)
          .set({ validatedAddress: { [Network.RMS]: tmp.bech32 } }, { merge: true });
      }
      const memberId = validateSpace ? member : tmp.bech32;
      await requestFundsFromFaucet(Network.RMS, tmp.bech32, 5 * MIN_IOTA_AMOUNT);

      const request = {
        requestType: TangleRequestType.ADDRESS_VALIDATION,
      };
      validateSpace && set(request, 'space', space);
      await wallet.send(tmp, tangleOrder.payload.targetAddress, MIN_IOTA_AMOUNT, {
        customMetadata: { request },
      });

      const query = admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', memberId);

      await wait(async () => {
        const snap = await query.get();
        return snap.size > 0 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
      });

      if (validateSpace) {
        const spaceData = <Space>(
          (await admin.firestore().doc(`${COL.SPACE}/${space}`).get()).data()
        );
        expect(spaceData.validatedAddress![Network.RMS]).toBe(tmp.bech32);
      } else {
        const member = <Member>(
          (await admin.firestore().doc(`${COL.MEMBER}/${memberId}`).get()).data()
        );
        expect(member.validatedAddress![Network.RMS]).toBe(tmp.bech32);
        expect(member.prevValidatedAddresses).toEqual([tmp.bech32]);
      }

      const snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('member', '==', memberId)
        .where('payload.type', '==', TransactionUnlockType.TANGLE_TRANSFER)
        .get();
      expect(snap.size).toBe(1);
    },
  );

  it.each([false, true])(
    'Should validate atoi address with tangle request',
    async (validateSpace) => {
      const rmsWallet = (await WalletService.newWallet(Network.RMS)) as SmrWallet;
      const rmsTmp = await rmsWallet.getNewIotaAddressDetails();
      const atoiWallet = (await WalletService.newWallet(Network.ATOI)) as IotaWallet;
      const atoiTmp = await atoiWallet.getNewIotaAddressDetails();
      if (validateSpace) {
        space = (await createSpace(walletSpy, member)).uid;
        await admin.firestore().doc(`${COL.SPACE}/${space}`).update({ validatedAddress: {} });
        await admin
          .firestore()
          .doc(`${COL.MEMBER}/${member}`)
          .set({ validatedAddress: { [Network.RMS]: rmsTmp.bech32 } }, { merge: true });
      }
      const memberId = validateSpace ? member : rmsTmp.bech32;

      await requestFundsFromFaucet(Network.RMS, rmsTmp.bech32, 5 * MIN_IOTA_AMOUNT);
      await requestFundsFromFaucet(Network.ATOI, atoiTmp.bech32, 5 * MIN_IOTA_AMOUNT);

      const request = {
        requestType: TangleRequestType.ADDRESS_VALIDATION,
        network: Network.ATOI,
      };
      validateSpace && set(request, 'space', space);
      await rmsWallet.send(rmsTmp, tangleOrder.payload.targetAddress, MIN_IOTA_AMOUNT, {
        customMetadata: { request },
      });

      let query = admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('member', '==', memberId)
        .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
      await wait(async () => {
        const snap = await query.get();
        return snap.size > 0 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
      });
      let snap = await query.get();
      expect(snap.size).toBe(1);
      const response = await getRmsSoonTangleResponse(snap.docs[0], rmsWallet);
      await atoiWallet.send(atoiTmp, response.address, response.amount, {});

      query = admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', memberId);
      await wait(async () => {
        const snap = await query.get();
        return snap.size > 0 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
      });

      if (validateSpace) {
        const spaceData = <Space>(
          (await admin.firestore().doc(`${COL.SPACE}/${space}`).get()).data()
        );
        expect(spaceData.validatedAddress![Network.ATOI]).toBe(atoiTmp.bech32);
      } else {
        const member = <Member>(
          (await admin.firestore().doc(`${COL.MEMBER}/${memberId}`).get()).data()
        );
        expect(member.validatedAddress![Network.RMS]).toBe(rmsTmp.bech32);
        expect(member.validatedAddress![Network.ATOI]).toBe(atoiTmp.bech32);
        expect(member.prevValidatedAddresses).toBeUndefined();
      }

      snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('member', '==', memberId)
        .where('payload.type', '==', TransactionUnlockType.TANGLE_TRANSFER)
        .get();
      expect(snap.size).toBe(0);
    },
  );
});
