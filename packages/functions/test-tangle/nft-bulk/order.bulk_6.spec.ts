import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
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

  it('Should order 2 nfts, only one available', async () => {
    const { collection: col1, nft: nft1 } = await h.createColletionAndNft(h.member, h.space);
    const { collection: col2, nft: nft2 } = await h.createColletionAndNft(h.member, h.space);
    const nft1DocRef = build5Db().doc(`${COL.NFT}/${nft1.uid}`);
    const nft2DocRef = build5Db().doc(`${COL.NFT}/${nft2.uid}`);
    await nft2DocRef.update({ locked: true });

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
    await MnemonicService.store(h.memberAddress.bech32, h.memberAddress.mnemonic);

    let query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.member)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length === 1 && snap[0].payload.walletReference?.confirmed;
    });

    const credit = (await query.get<Transaction>())[0];
    expect(credit.payload.amount).toBe(2 * MIN_IOTA_AMOUNT);
    expect(credit.payload.response!.amount).toBe(MIN_IOTA_AMOUNT);
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
  });
});
