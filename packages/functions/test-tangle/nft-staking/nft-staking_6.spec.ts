import { database } from '@buildcore/database';
import {
  COL,
  KEY_NAME_TANGLE,
  Network,
  Nft,
  StakeType,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { NftOutput, NftOutputBuilderParams, TagFeature, Utils, utf8ToHex } from '@iota/sdk';
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

  it.each([false, true])('Should stake with tag', async (migration: boolean) => {
    let nft = await helper.createAndOrderNft();
    let nftDocRef = database().doc(COL.NFT, nft.uid);
    await helper.mintCollection();
    nft = <Nft>await nftDocRef.get();
    await helper.withdrawNftAndAwait(nft.uid);

    if (migration) {
      await nftDocRef.delete();
      await database().doc(COL.COLLECTION, nft.collection).delete();
    }

    mockWalletReturnValue(helper.guardian!, {
      network: Network.RMS,
      weeks: 25,
      type: StakeType.DYNAMIC,
    });

    const nftOutputId = await helper.walletService!.client.nftOutputId(nft.mintingData?.nftId!);
    const nftOutput = <NftOutput>(await helper.walletService!.client.getOutput(nftOutputId)).output;
    const nftOutputParams = <NftOutputBuilderParams>nftOutput;
    const tag = KEY_NAME_TANGLE + KEY_NAME_TANGLE + KEY_NAME_TANGLE;
    nftOutputParams.features = nftOutput.features || [];
    nftOutputParams.features.push(new TagFeature(utf8ToHex(tag)));
    const output = await helper.walletService!.client.buildNftOutput(nftOutputParams);
    const storageDeposit = Utils.computeStorageDeposit(
      output,
      helper.walletService!.info.protocol.rentStructure,
    );
    const extraAmount = Number(storageDeposit) - Number(nftOutput.amount);
    const stakeNftOrder = await testEnv.wrap<Transaction>(WEN_FUNC.stakeNft);
    await helper.sendNftToAddress(
      helper.guardianAddress!,
      stakeNftOrder.payload.targetAddress!,
      undefined,
      nft.mintingData?.nftId,
      extraAmount,
      tag,
    );

    const stakeQuery = database()
      .collection(COL.NFT_STAKE)
      .where('nft', '==', migration ? nft.mintingData?.nftId : nft.uid);
    await wait(async () => {
      const snap = await stakeQuery.get();
      return snap.length === 1;
    });
  });
});
