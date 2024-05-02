/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import { COL, Member, Nft, Transaction, TransactionType, WEN_FUNC } from '@buildcore/interfaces';
import { getAddress } from '../../src/utils/address.utils';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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

    mockWalletReturnValue(helper.guardian!, { nft: helper.nft!.uid });
    await testEnv.wrap(WEN_FUNC.withdrawNft);
    const query = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload_nft', '==', helper.nft!.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    await database().doc(COL.COLLECTION, helper.collection!).update({ approved: false });

    const guardianData = <Member>await database().doc(COL.MEMBER, helper.guardian!).get();
    mockWalletReturnValue(helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap<Transaction>(WEN_FUNC.depositNft);
    const sourceAddress = await helper.walletService?.getAddressDetails(
      getAddress(guardianData, helper.network!),
    );
    await helper.sendNftToAddress(sourceAddress!, depositOrder.payload.targetAddress!);

    const creditNftQuery = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_NFT)
      .where('member', '==', helper.guardian);
    await wait(async () => {
      const snap = await creditNftQuery.get();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    const nft = <Nft>await database().doc(COL.NFT, helper.nft!.uid).get();
    const creditNftTransaction = (await creditNftQuery.get())[0] as Transaction;
    expect(creditNftTransaction.payload.nftId).toBe(nft.mintingData?.nftId);
  });
});
