import { TIMELOCK_UNLOCK_CONDITION_TYPE } from '@iota/iota.js-next';
import { COL, Collection, Network, Nft, NftStake, StakeType } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { stakeNft } from '../../src/runtime/firebase/nft';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Stake nft', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should stake nft minted outside soonaverse', async () => {
    let nft = await helper.createAndOrderNft();
    let nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
    await helper.mintCollection();
    await helper.withdrawNftAndAwait(nft.uid);

    nft = <Nft>(await nftDocRef.get()).data();
    await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).delete();
    await admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`).delete();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      network: Network.RMS,
      weeks: 25,
      type: StakeType.DYNAMIC,
    });
    const stakeNftOrder = await testEnv.wrap(stakeNft)({});
    await helper.sendNftToAddress(
      helper.guardianAddress!,
      stakeNftOrder.payload.targetAddress,
      dateToTimestamp(dayjs().add(2, 'd')),
      nft.mintingData?.nftId,
    );

    const stakeQuery = admin
      .firestore()
      .collection(COL.NFT_STAKE)
      .where('nft', '==', nft.mintingData?.nftId);
    await wait(async () => {
      const snap = await stakeQuery.get();
      return snap.size === 1;
    });

    nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.mintingData?.nftId}`);
    nft = <Nft>(await nftDocRef.get()).data();
    const snap = await stakeQuery.get();
    const nftStake = snap.docs[0].data() as NftStake;
    expect(nftStake.member).toBe(helper.guardian);
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
      output.unlockConditions.find((uc) => uc.type === TIMELOCK_UNLOCK_CONDITION_TYPE),
    ).toBeDefined();

    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${nftStake.collection}`);
    const collection = <Collection>(await collectionDocRef.get()).data();
    expect(collection.stakedNft).toBe(1);
  });
});
