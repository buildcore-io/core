import {
  IndexerPluginClient,
  INftOutput,
  TAG_FEATURE_TYPE,
  TransactionHelper,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import { COL, KEY_NAME_TANGLE, Network, Nft, StakeType } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { stakeNft } from '../../src/runtime/firebase/nft';
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

  it.each([false, true])('Should stake with tag', async (migration: boolean) => {
    let nft = await helper.createAndOrderNft();
    let nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
    await helper.mintCollection();
    nft = <Nft>(await nftDocRef.get()).data();
    await helper.withdrawNftAndAwait(nft.uid);

    if (migration) {
      await nftDocRef.delete();
      await admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`).delete();
    }

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      network: Network.RMS,
      weeks: 25,
      type: StakeType.DYNAMIC,
    });

    const indexer = new IndexerPluginClient(helper.walletService!.client);
    const items = (await indexer.nft(nft.mintingData?.nftId!)).items;
    const nftOutput = <INftOutput>(await helper.walletService!.client.output(items[0])).output;
    const tag = KEY_NAME_TANGLE + KEY_NAME_TANGLE + KEY_NAME_TANGLE;
    nftOutput.features = nftOutput.features || [];
    nftOutput.features.push({ type: TAG_FEATURE_TYPE, tag: Converter.utf8ToHex(tag) });
    const extraAmount =
      TransactionHelper.getStorageDeposit(
        nftOutput,
        helper.walletService!.info.protocol.rentStructure,
      ) - Number(nftOutput.amount);
    const stakeNftOrder = await testEnv.wrap(stakeNft)({});
    await helper.sendNftToAddress(
      helper.guardianAddress!,
      stakeNftOrder.payload.targetAddress,
      undefined,
      nft.mintingData?.nftId,
      extraAmount,
      tag,
    );

    const stakeQuery = admin
      .firestore()
      .collection(COL.NFT_STAKE)
      .where('nft', '==', migration ? nft.mintingData?.nftId : nft.uid);
    await wait(async () => {
      const snap = await stakeQuery.get();
      return snap.size === 1;
    });
  });
});
