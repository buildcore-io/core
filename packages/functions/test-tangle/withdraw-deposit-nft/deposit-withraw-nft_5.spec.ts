/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Member, Nft, Transaction, TransactionType } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { depositNft, withdrawNft } from '../../src/controls/nft/nft.control';
import { getAddress } from '../../src/utils/address.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Collection minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should throw, can not deposit nft if collection is rejected.', async () => {
    await helper.createAndOrderNft();
    await helper.mintCollection();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: helper.nft!.uid });
    await testEnv.wrap(withdrawNft)({});
    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', helper.nft!.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });

    await admin
      .firestore()
      .doc(`${COL.COLLECTION}/${helper.collection}`)
      .update({ approved: false });

    const guardianData = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${helper.guardian}`).get()).data()
    );
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    const sourceAddress = await helper.walletService?.getAddressDetails(
      getAddress(guardianData, helper.network!),
    );
    await helper.sendNftToAddress(sourceAddress!, depositOrder.payload.targetAddress);

    const creditNftQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_NFT)
      .where('member', '==', helper.guardian);
    await wait(async () => {
      const snap = await creditNftQuery.get();
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });

    const nft = <Nft>(await admin.firestore().doc(`${COL.NFT}/${helper.nft!.uid}`).get()).data();
    const creditNftTransaction = (await creditNftQuery.get()).docs[0].data() as Transaction;
    expect(creditNftTransaction.payload.nftId).toBe(nft.mintingData?.nftId);
  });
});
