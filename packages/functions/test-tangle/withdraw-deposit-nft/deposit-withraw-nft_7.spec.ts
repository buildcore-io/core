/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import { COL, Network, Nft, Transaction, TransactionType } from '@build-5/interfaces';
import { depositNft, withdrawNft } from '../../src/runtime/firebase/nft/index';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Collection minting', () => {
  const helper = new Helper();
  let nft: Nft;

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
    nft = await helper.createAndOrderNft();
    await helper.mintCollection();

    const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: nft.uid });
    await testEnv.wrap(withdrawNft)({});

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', nft.uid);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    nft = <Nft>await nftDocRef.get();
  });

  it('Should deposit and claim space', async () => {
    const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);

    await nftDocRef.delete();
    await build5Db().doc(`${COL.COLLECTION}/${nft.collection}`).delete();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(helper.guardianAddress!, depositOrder.payload.targetAddress);

    const nftQuery = build5Db().collection(COL.NFT).where('owner', '==', helper.guardian);
    await wait(async () => {
      const snap = await nftQuery.get();
      return snap.length > 0;
    });
    const snap = await nftQuery.get();
    const migratedNft = <Nft>snap[0];

    await helper.claimSpaceFunc(migratedNft.space);
    await helper.claimSpaceFunc(helper.royaltySpace!.validatedAddress![Network.RMS]);
  });
});
