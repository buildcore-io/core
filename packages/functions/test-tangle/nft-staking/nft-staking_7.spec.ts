import { database } from '@buildcore/database';
import {
  COL,
  Network,
  Nft,
  StakeType,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Stake nft', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should credit twice', async () => {
    let nft = await helper.createAndOrderNft();
    let nftDocRef = database().doc(COL.NFT, nft.uid);
    await helper.mintCollection();
    nft = <Nft>await nftDocRef.get();
    await helper.withdrawNftAndAwait(nft.uid);

    mockWalletReturnValue(helper.guardian!, {
      network: Network.RMS,
      weeks: 25,
      type: StakeType.DYNAMIC,
    });
    const stakeNftOrder = await testEnv.wrap<Transaction>(WEN_FUNC.stakeNft);
    await helper.sendNftToAddress(
      helper.guardianAddress!,
      stakeNftOrder.payload.targetAddress!,
      undefined,
      nft.mintingData?.nftId,
    );

    const creditQuery = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_NFT)
      .where('member', '==', helper.guardian);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    await helper.sendNftToAddress(
      helper.guardianAddress!,
      stakeNftOrder.payload.targetAddress!,
      undefined,
      nft.mintingData?.nftId,
    );

    await wait(async () => {
      const snap = await creditQuery.get();
      return (
        snap.length === 2 &&
        snap[0]?.payload?.walletReference?.confirmed &&
        snap[1]?.payload?.walletReference?.confirmed
      );
    });
  });
});
