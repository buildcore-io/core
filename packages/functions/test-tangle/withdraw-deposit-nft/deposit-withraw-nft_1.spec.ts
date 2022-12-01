/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Nft,
  NftStatus,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEqual } from 'lodash';
import admin from '../../src/admin.config';
import { depositNft, withdrawNft } from '../../src/controls/nft/nft.control';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { getWallet, testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Collection minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it.each([false, true])(
    'Should withdraw minted nft and deposit it back',
    async (hasExpiration: boolean) => {
      const expiresAt = hasExpiration ? dateToTimestamp(dayjs().add(2, 'h').toDate()) : undefined;

      let nft = await helper.createAndOrderNft();
      await helper.mintCollection(expiresAt);
      const tmpAddress = await helper.walletService!.getNewIotaAddressDetails();
      await helper.updateGuardianAddress(tmpAddress.bech32);

      const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
      const mintingData = (<Nft>(await nftDocRef.get()).data()).mintingData;
      mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: nft.uid });
      await testEnv.wrap(withdrawNft)({});
      const query = admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.WITHDRAW_NFT)
        .where('payload.nft', '==', nft.uid);
      await wait(async () => {
        const snap = await query.get();
        return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
      });
      nft = <Nft>(await nftDocRef.get()).data();
      expect(nft.status).toBe(NftStatus.WITHDRAWN);
      expect(nft.hidden).toBe(true);
      expect(isEqual(nft.mintingData, mintingData)).toBe(true);

      const wallet = (await getWallet(helper.network)) as SmrWallet;
      const guardianData = <Member>(
        (await admin.firestore().doc(`${COL.MEMBER}/${helper.guardian}`).get()).data()
      );
      const nftWallet = new NftWallet(wallet);
      let outputs = await nftWallet.getNftOutputs(
        undefined,
        getAddress(guardianData, helper.network!),
      );
      expect(Object.keys(outputs).length).toBe(1);

      mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
      let depositOrder = await testEnv.wrap(depositNft)({});

      const sourceAddress = await helper.walletService?.getAddressDetails(
        getAddress(guardianData, helper.network!),
      );
      await helper.sendNftToAddress(sourceAddress!, depositOrder.payload.targetAddress, expiresAt);

      await wait(async () => {
        nft = <Nft>(await nftDocRef.get()).data();
        return nft.status === NftStatus.MINTED;
      });
      depositOrder = <Transaction>(
        (await admin.firestore().doc(`${COL.TRANSACTION}/${depositOrder.uid}`).get()).data()
      );
      expect(nft.depositData?.storageDeposit).toBe(
        Number(Object.values(outputs)[0].amount) + (expiresAt ? MIN_IOTA_AMOUNT : 0),
      );
      expect(nft.depositData?.address).toBe(depositOrder.payload.targetAddress);
      expect(nft.depositData?.mintedBy).toBe(helper.guardian);
      expect(nft.depositData?.network).toBe(helper.network);
      expect(nft.depositData?.nftId).toBe(mintingData?.nftId);
      expect(nft.depositData?.blockId).toBeDefined();
      expect(nft.depositData?.mintingOrderId).toBe(depositOrder.uid);
      expect(nft.hidden).toBe(false);

      expect(depositOrder.payload.nft).toBe(nft.uid);
      expect(depositOrder.payload.amount).toBe(nft.depositData?.storageDeposit);
      expect(depositOrder.space).toBe(nft.space);

      outputs = await nftWallet.getNftOutputs(undefined, getAddress(guardianData, helper.network));
      expect(Object.keys(outputs).length).toBe(0);
    },
  );

  it('Should credit nft with expiration unlock, expired order', async () => {
    const expiresAt = dateToTimestamp(dayjs().add(2, 'h').toDate());
    let nft = await helper.createAndOrderNft();
    await helper.mintCollection(expiresAt);
    const tmpAddress = await helper.walletService!.getNewIotaAddressDetails();
    await helper.updateGuardianAddress(tmpAddress.bech32);

    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
    const mintingData = (<Nft>(await nftDocRef.get()).data()).mintingData;
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: nft.uid });
    await testEnv.wrap(withdrawNft)({});
    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', nft.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });
    nft = <Nft>(await nftDocRef.get()).data();
    expect(nft.status).toBe(NftStatus.WITHDRAWN);
    expect(nft.hidden).toBe(true);
    expect(isEqual(nft.mintingData, mintingData)).toBe(true);

    const wallet = (await getWallet(helper.network)) as SmrWallet;
    const guardianData = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${helper.guardian}`).get()).data()
    );
    const nftWallet = new NftWallet(wallet);
    let outputs = await nftWallet.getNftOutputs(
      undefined,
      getAddress(guardianData, helper.network!),
    );
    expect(Object.keys(outputs).length).toBe(1);

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    await admin
      .firestore()
      .doc(`${COL.TRANSACTION}/${depositOrder.uid}`)
      .update({ 'payload.expiresOn': dateToTimestamp(dayjs().subtract(2, 'h').toDate()) });

    const sourceAddress = await helper.walletService?.getAddressDetails(
      getAddress(guardianData, helper.network!),
    );
    await helper.sendNftToAddress(sourceAddress!, depositOrder.payload.targetAddress, expiresAt);

    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT_NFT)
        .where('member', '==', helper.guardian!)
        .get();
      return (
        snap.size === 1 &&
        snap.docs[0].data()!.payload.walletReference?.confirmed &&
        snap.docs[0].data()!.payload.targetAddress === sourceAddress!.bech32
      );
    });

    outputs = await nftWallet.getNftOutputs(undefined, getAddress(guardianData, helper.network));
    expect(Object.keys(outputs).length).toBe(1);
  });
});
