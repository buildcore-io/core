import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@buildcore/interfaces';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
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

  it('Should order 2 nfts, buy only one with tangle', async () => {
    const { collection: col1, nft: nft1 } = await h.createCollectionAndNft(h.member, h.space);
    const { collection: col2, nft: nft2 } = await h.createCollectionAndNft(h.member, h.space);

    await requestFundsFromFaucet(Network.ATOI, h.memberAddress.bech32, 3 * MIN_IOTA_AMOUNT);
    await h.walletService.send(
      h.memberAddress,
      tangleOrder.payload.targetAddress!,
      3 * MIN_IOTA_AMOUNT,
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
    await MnemonicService.store(h.memberAddress.bech32, h.memberAddress.mnemonic);

    let query = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.member)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1 && snap[0].payload.walletReference?.confirmed;
    });

    const nft1DocRef = database().doc(COL.NFT, nft1.uid);
    const nft2DocRef = database().doc(COL.NFT, nft2.uid);
    await nft2DocRef.update({ locked: true });

    const credit = (await query.get())[0];
    await h.walletService.send(
      h.memberAddress,
      credit.payload.response!.address as string,
      credit.payload.response!.amount as number,
      {},
    );

    await wait(async () => {
      const nft1 = <Nft>await nft1DocRef.get();
      return nft1.owner === h.member;
    });

    query = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', h.member);

    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
    const snap = await query.get();
    expect(snap[0].payload.amount).toBe(1 * MIN_IOTA_AMOUNT);
  });
});
