/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Member, Nft, Transaction, TransactionType } from '@build5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { depositNft, withdrawNft } from '../../src/runtime/firebase/nft/index';
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
    const query = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', helper.nft!.uid);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    await soonDb().doc(`${COL.COLLECTION}/${helper.collection}`).update({ approved: false });

    const guardianData = <Member>await soonDb().doc(`${COL.MEMBER}/${helper.guardian}`).get();
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    const sourceAddress = await helper.walletService?.getAddressDetails(
      getAddress(guardianData, helper.network!),
    );
    await helper.sendNftToAddress(sourceAddress!, depositOrder.payload.targetAddress);

    const creditNftQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_NFT)
      .where('member', '==', helper.guardian);
    await wait(async () => {
      const snap = await creditNftQuery.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    const nft = <Nft>await soonDb().doc(`${COL.NFT}/${helper.nft!.uid}`).get();
    const creditNftTransaction = (await creditNftQuery.get())[0] as Transaction;
    expect(creditNftTransaction.payload.nftId).toBe(nft.mintingData?.nftId);
  });
});
