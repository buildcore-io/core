import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  TangleRequestType,
  Transaction,
} from '@build-5/interfaces';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Nft bulk order', () => {
  const h = new Helper();
  let tangleOrder: Transaction;

  beforeEach(async () => {
    await h.beforeEach();
    tangleOrder = await getTangleOrder(Network.ATOI);
  });

  it('Should order 2 nfts with tangle order', async () => {
    const { collection: col1, nft: nft1 } = await h.createColletionAndNft(h.member, h.space);
    const { collection: col2, nft: nft2 } = await h.createColletionAndNft(h.member, h.space);

    await requestFundsFromFaucet(Network.ATOI, h.memberAddress.bech32, 2 * MIN_IOTA_AMOUNT);
    await h.walletService.send(
      h.memberAddress,
      tangleOrder.payload.targetAddress!,
      2 * MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.NFT_PURCHASE_BULK,
            orders: [
              { collection: col1.uid, nft: nft1.uid },
              { collection: col2.uid, nft: nft2.uid },
            ],
          },
        },
      },
    );

    const nft1DocRef = build5Db().doc(`${COL.NFT}/${nft1.uid}`);
    const nft2DocRef = build5Db().doc(`${COL.NFT}/${nft2.uid}`);

    await wait(async () => {
      const nft1 = <Nft>await nft1DocRef.get();
      const nft2 = <Nft>await nft2DocRef.get();
      return nft1.owner === h.member && nft2.owner === h.member;
    });
  });
});
