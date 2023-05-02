import {
  IAliasOutput,
  IndexerPluginClient,
  REFERENCE_UNLOCK_TYPE,
  TransactionHelper,
} from '@iota/iota.js-next';
import { COL, Collection, CollectionStatus, Network, Transaction } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions/v2';
import { SmrWallet } from '../../../src/services/wallet/SmrWalletService';
import { WalletService } from '../../../src/services/wallet/wallet';
import { packBasicOutput } from '../../../src/utils/basic-output.utils';
import { packEssence, packPayload, submitBlock } from '../../../src/utils/block.utils';
import { isProdEnv } from '../../../src/utils/config.utils';
import { createUnlock } from '../../../src/utils/smr.utils';
import { soonDb } from '../../firebase/firestore/soondb';

export const collectionRoll = functions.https.onRequest(async (_, res) => {
  if (isProdEnv()) {
    await rollMintingCollection();
  }
  res.send('ok');
});

const rollMintingCollection = async () => {
  const collectionId = '0xe58a0148d8ca16269e27c8d31adb8aeec812770b';
  const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${collectionId}`);
  const collection = <Collection>await collectionDocRef.get();

  if (collection.status !== CollectionStatus.MINTING) {
    return;
  }

  const orderId = collection.mintingData?.mintingOrderId;
  const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${orderId}`);
  const order = <Transaction>await orderDocRef.get();

  const wallet = (await WalletService.newWallet(Network.SMR)) as SmrWallet;

  const sourceAddress = 'smr1qrvn06xlaetvs5hettzjmsurgm76lzhgnpat76dyzqezxvuxcattv8vcg8e';
  try {
    const balance = await wallet.getBalance(sourceAddress);
    await orderDocRef.delete();
    functions.logger.info('deleting order', order);

    const aliasIdsToBurn = [
      '0x0618fc96d28b9a4401aac829eb80922d1f2eb779602f20d481b944190e1d6811',
      '0x42134dbe69fdb67fcc921e44ab5d109c5177b9a8e20434725757e9acfe241cd8',
    ];
    const blockId = await burnAliases(wallet, aliasIdsToBurn, sourceAddress);
    functions.logger.info('Burn aliases block id', blockId);

    for (let attempt = 0; attempt < 300; ++attempt) {
      const actBalance = await wallet.getBalance(sourceAddress);
      if (actBalance > balance) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    await new Promise((r) => setTimeout(r, 2000));

    await collectionDocRef.update({
      'mintingData.aliasId': '0x270b3ac31b95e5c21c7b37a244c1e9fbd99677eff75a53fda11b21f06ee59b91',
      'mintingData.aliasBlockId':
        '0x808f147a9718e84f36b5ef2e9490fd75eb4dba1bf1b0e15e726363cd909ed997',
    });

    const transactionsToDelete = [
      '0xd6fbe90329897ad2702d7d147a64219b534f2256',
      '0x1df40dadfbdee8fdc9f13a339d5cbb2296e4cc8e',
      '0x4e7b25375455f3833ee8686dbfcea7e45847ee03',
      '0x7f927795d32ef53306df0551f59e036ee0464b15',
    ];
    for (const tranId of transactionsToDelete) {
      const docRef = soonDb().doc(`${COL.TRANSACTION}/${tranId}`);
      await docRef.delete();
    }

    const nftMintTrans = '0x5ca63f05f31aa657e5e35d710075aa483149747a';
    const nftMintTranDocRef = soonDb().doc(`${COL.TRANSACTION}/${nftMintTrans}`);
    await nftMintTranDocRef.update({ 'payload.walletReference.count': 0, shouldRetry: true });
  } finally {
    await orderDocRef.create(order);
  }
};

const burnAliases = async (wallet: SmrWallet, aliasIdsToBurn: string[], addressBech32: string) => {
  const address = await wallet.getAddressDetails(addressBech32);

  const aliasOutputsMap = await getAliasOutputs(aliasIdsToBurn, wallet);
  const aliasOutputIds = Object.keys(aliasOutputsMap);
  const aliasOutputs = Object.values(aliasOutputsMap);

  const remainderAmount = aliasOutputs.reduce((acc, act) => acc + Number(act.amount), 0);
  const remainder = packBasicOutput(address.bech32, remainderAmount, [], wallet.info);

  const inputs = aliasOutputIds.map(TransactionHelper.inputFromOutputId);
  const inputsCommitment = TransactionHelper.getInputsCommitment(aliasOutputs);
  const essence = packEssence(inputs, inputsCommitment, [remainder], wallet, {});

  return await submitBlock(
    wallet,
    packPayload(essence, [
      createUnlock(essence, address.keyPair),
      { type: REFERENCE_UNLOCK_TYPE, reference: 0 },
    ]),
  );
};

const getAliasOutputs = async (aliasIds: string[], wallet: SmrWallet) => {
  const indexer = new IndexerPluginClient(wallet.client);
  const result: { [key: string]: IAliasOutput } = {};
  for (const aliasId of aliasIds) {
    const indexerResult = await indexer.alias(aliasId);
    const output = await wallet.client.output(indexerResult.items[0]);
    result[indexerResult.items[0]] = output.output as IAliasOutput;
  }
  return result;
};
