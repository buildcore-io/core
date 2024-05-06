import { database } from '@buildcore/database';
import {
  COL,
  Collection,
  Network,
  Nft,
  NftStake,
  StakeType,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { UnlockConditionType } from '@iota/sdk';
import dayjs from 'dayjs';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
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

  it('Should stake nft minted outside buildcore', async () => {
    let nft = await helper.createAndOrderNft();
    let nftDocRef = database().doc(COL.NFT, nft.uid);
    await helper.mintCollection();
    await helper.withdrawNftAndAwait(nft.uid);

    nft = <Nft>await nftDocRef.get();
    await database().doc(COL.NFT, nft.uid).delete();
    await database().doc(COL.COLLECTION, nft.collection).delete();

    mockWalletReturnValue(helper.guardian!, {
      network: Network.RMS,
      weeks: 25,
      type: StakeType.DYNAMIC,
    });
    let stakeNftOrder = await testEnv.wrap<Transaction>(WEN_FUNC.stakeNft);
    await helper.sendNftToAddress(
      helper.guardianAddress!,
      stakeNftOrder.payload.targetAddress!,
      dateToTimestamp(dayjs().add(2, 'd')),
      nft.mintingData?.nftId,
    );

    const stakeQuery = database()
      .collection(COL.NFT_STAKE)
      .where('nft', '==', nft.mintingData?.nftId);
    await wait(async () => {
      const snap = await stakeQuery.get();
      return snap.length === 1;
    });

    nftDocRef = database().doc(COL.NFT, nft.mintingData?.nftId!);
    nft = <Nft>await nftDocRef.get();
    const snap = await stakeQuery.get();
    const nftStake = snap[0] as NftStake;
    expect(nftStake.member).toBe(helper.guardian!);
    expect(nftStake.space).toBe(nft.space);
    expect(nftStake.collection).toBe(nft.collection);
    expect(nftStake.nft).toBe(nft.uid);
    expect(nftStake.weeks).toBe(25);
    expect(nftStake.expiresAt).toBeDefined();
    expect(nftStake.expirationProcessed).toBe(false);
    expect(nftStake.type).toBe(StakeType.DYNAMIC);

    const nftWallet = new NftWallet(helper.walletService!);
    const nftOutputs = await nftWallet.getNftOutputs(undefined, helper.guardianAddress!.bech32, []);
    expect(Object.keys(nftOutputs).length).toBe(1);
    const output = Object.values(nftOutputs)[0];
    expect(
      output.unlockConditions.find((uc) => uc.type === UnlockConditionType.Timelock),
    ).toBeDefined();

    const collectionDocRef = database().doc(COL.COLLECTION, nftStake.collection);
    const collection = <Collection>await collectionDocRef.get();
    expect(collection.stakedNft).toBe(1);

    const stakeNftOrderDocRef = database().doc(COL.TRANSACTION, stakeNftOrder.uid);
    stakeNftOrder = <Transaction>await stakeNftOrderDocRef.get();
    expect(stakeNftOrder.payload.nft).toBe(nft.uid);
  });
});
