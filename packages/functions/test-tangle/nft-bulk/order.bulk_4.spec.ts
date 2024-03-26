import { build5Db } from '@build-5/database';
import { COL, CollectionType, Nft, Transaction, WEN_FUNC } from '@build-5/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Nft bulk order', () => {
  const h = new Helper();

  beforeEach(async () => {
    await h.beforeEach();
  });

  it('Should order 2 nfts, 2 random', async () => {
    const { collection: col1, nft: nft1 } = await h.createCollectionAndNft(h.member, h.space);
    const { collection: col2, nft: nft2 } = await h.createCollectionAndNft(h.member, h.space);
    const { collection: col3 } = await h.createCollectionAndNft(
      h.member,
      h.space,
      CollectionType.GENERATED,
    );
    await h.createNft(h.member, col3);
    await h.createNft(h.member, col3);
    await h.createNft(h.member, col3);

    const request = {
      orders: [
        { collection: col1.uid, nft: nft1.uid },
        { collection: col2.uid, nft: nft2.uid },
        { collection: col3.uid },
        { collection: col3.uid },
      ],
    };
    mockWalletReturnValue(h.member, request);
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.orderNftBulk);
    await requestFundsFromFaucet(
      order.network,
      order.payload.targetAddress!,
      order.payload.amount!,
    );

    await wait(async () => {
      const promises = order.payload.nftOrders!.map(async (nftOrder) => {
        const docRef = build5Db().doc(COL.NFT, nftOrder.nft);
        return <Nft>await docRef.get();
      });
      const nfts = await Promise.all(promises);
      return nfts.length === 4 && nfts.reduce((acc, act) => acc && act.owner === h.member, true);
    });
  });
});
