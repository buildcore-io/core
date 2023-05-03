import {
  ALIAS_UNLOCK_TYPE,
  IAliasOutput,
  IndexerPluginClient,
  SingleNodeClient,
  TransactionHelper,
} from '@iota/iota.js-next';
import {
  COL,
  Collection,
  CollectionStatus,
  Network,
  Nft,
  NftStatus,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions/v2';
import { cloneDeep, set } from 'lodash';
import { soonDb } from '../firebase/firestore/soondb';
import { NftWallet } from '../services/wallet/NftWallet';
import { SmrWallet } from '../services/wallet/SmrWalletService';
import { MnemonicService } from '../services/wallet/mnemonic';
import { WalletService } from '../services/wallet/wallet';
import { packBasicOutput } from '../utils/basic-output.utils';
import { packEssence, packPayload, submitBlock } from '../utils/block.utils';
import { isProdEnv } from '../utils/config.utils';
import { createUnlock } from '../utils/smr.utils';
import { getAliasBech32Address } from '../utils/token-minting-utils/alias.utils';

const availabledProdCollections = [
  '0x7d1d7f2ba7f053bb86eb79eaf32bbf52b2c04a25',
  '0x4254fba1c5e487b44f415072230f4148c6c03d1f',
];

export const rollbackCollectionMint = functions.https.onRequest(
  { maxInstances: 1, timeoutSeconds: 3600 },
  async (req, res) => {
    const collectionId = req.body.collectionId;
    if (isProdEnv()) {
      if (!availabledProdCollections.includes(collectionId)) {
        res.status(400).send('invalid collection id');
        return;
      }
    }

    await rollMintingCollection(collectionId);
    res.send('ok');
  },
);

const rollMintingCollection = async (collectionId: string) => {
  const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${collectionId}`);
  const collection = <Collection>await collectionDocRef.get();

  const orderId = collection.mintingData?.mintingOrderId;
  const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${orderId}`);
  const order = <Transaction>await orderDocRef.get();

  const wallet = (await WalletService.newWallet(collection.mintingData!.network!)) as SmrWallet;

  const transactions = await soonDb()
    .collection(COL.TRANSACTION)
    .where('payload.collection', '==', collectionId)
    .where('type', '==', TransactionType.MINT_COLLECTION)
    .get<Transaction>();

  try {
    await orderDocRef.delete();
    await burnNfts(collection, wallet, order.payload.targetAddress);
    await burnAliases(collection, wallet, order.payload.targetAddress);

    for (const tran of transactions) {
      const docRef = soonDb().doc(`${COL.TRANSACTION}/${tran.uid}`);
      await docRef.delete();
    }
  } finally {
    set(order, 'payload.nftsToMint', collection.total);
    await orderDocRef.create(order);
  }
};

const burnNfts = async (collection: Collection, wallet: SmrWallet, targetAddress: string) => {
  let size = 0;
  do {
    const nfts = await soonDb()
      .collection(COL.NFT)
      .where('collection', '==', collection.uid)
      .where('status', '==', NftStatus.MINTED)
      .limit(100)
      .get<Nft>();
    size = nfts.length;
    const promises = nfts.map((nft) => burnNft(nft, wallet, targetAddress));
    await Promise.all(promises);
    if (size) {
      await sendBalanceToItself(targetAddress, wallet, collection.mintingData?.network!);
    }
  } while (size);
};

const burnNft = async (nft: Nft, wallet: SmrWallet, targetAddress: string) => {
  if (nft.status !== NftStatus.MINTED) {
    return;
  }
  try {
    const indexer = new IndexerPluginClient(wallet.client);
    const sourceAddress = await wallet.getAddressDetails(nft.mintingData?.address!);

    const nftOutputId = (await indexer.nft(nft.mintingData?.nftId!)).items[0];
    const nftOutput = (await wallet.client.output(nftOutputId)).output;

    const remainder = packBasicOutput(targetAddress, Number(nftOutput.amount), [], wallet.info);

    const inputs = [nftOutputId].map(TransactionHelper.inputFromOutputId);
    const inputsCommitment = TransactionHelper.getInputsCommitment([nftOutput]);
    const essence = packEssence(inputs, inputsCommitment, [remainder], wallet, {});

    const blockId = await submitBlock(
      wallet,
      packPayload(essence, [createUnlock(essence, sourceAddress.keyPair)]),
    );
    console.log('burning nft', nft.uid, blockId);
    await awaitLedgerInclusionState(blockId, nft.mintingData?.network!);
  } catch {
    try {
      const nftAddress = await wallet.getAddressDetails(nft.mintingData?.address!);
      const balance = await wallet.getBalance(nftAddress.bech32);
      const blockId = await wallet.send(nftAddress, targetAddress, balance, {});
      console.log('burning nft, sending balance', nft.uid, blockId);
      await awaitLedgerInclusionState(blockId, nft.mintingData?.network!);
      await MnemonicService.store(
        nftAddress.bech32,
        nftAddress.mnemonic,
        nft.mintingData?.network!,
      );
    } catch {}
  } finally {
    const nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);
    await nftDocRef.update({
      'mintingData.address': soonDb().deleteField(),
      'mintingData.mintedOn': soonDb().deleteField(),
      'mintingData.mintedBy': soonDb().deleteField(),
      'mintingData.blockId': soonDb().deleteField(),
      'mintingData.nftId': soonDb().deleteField(),
      'mintingData.mintingOrderId': soonDb().deleteField(),
      status: NftStatus.PRE_MINTED,
    });
  }
};

export const awaitLedgerInclusionState = async (blockId: string, network: Network) => {
  await wait(async () => (await getLedgerInclusionState(blockId, network)) === 'included', 120);
};

const getLedgerInclusionState = async (blockId: string, network: Network) => {
  const client = new SingleNodeClient(
    network === Network.SMR ? 'https://api.shimmer.network' : 'https://api.testnet.shimmer.network',
  );
  return (await client.blockMetadata(blockId)).ledgerInclusionState;
};

const wait = async (func: () => Promise<boolean>, maxAttempt = 1200, delay = 500) => {
  for (let attempt = 0; attempt < maxAttempt; ++attempt) {
    if (await func()) {
      return;
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error('Timeout');
};

const burnAliases = async (collection: Collection, wallet: SmrWallet, targetAddress: string) => {
  const indexer = new IndexerPluginClient(wallet.client);
  let aliasItems = (await indexer.aliases({ governorBech32: targetAddress })).items;
  let promises = aliasItems.map((item) =>
    burnCollection(wallet, item, targetAddress, collection.mintingData?.network!),
  );
  await Promise.all(promises);

  aliasItems = (await indexer.aliases({ governorBech32: targetAddress })).items;
  promises = aliasItems.map((item) =>
    burnAlias(wallet, item, targetAddress, collection.mintingData?.network!),
  );
  await Promise.all(promises);
  await sendBalanceToItself(targetAddress, wallet, collection.mintingData?.network!);

  const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${collection.uid}`);

  await collectionDocRef.update({
    'mintingData.blockId': soonDb().deleteField(),
    'mintingData.nftId': soonDb().deleteField(),

    'mintingData.aliasBlockId': soonDb().deleteField(),
    'mintingData.aliasId': soonDb().deleteField(),

    'mintingData.nftsToMint': collection.total,
    'mintingData.nftMediaToPrepare': 1,
    status: CollectionStatus.MINTING,
  });

  await collectionDocRef.update({ 'mintingData.nftMediaToPrepare': 0 });
};

const burnCollection = async (
  wallet: SmrWallet,
  aliasOutputId: string,
  targetAddress: string,
  network: Network,
) => {
  const nftWallet = new NftWallet(wallet);

  const aliasOutput = (await wallet.client.output(aliasOutputId)).output as IAliasOutput;
  const aliasAddress = getAliasBech32Address(aliasOutput.aliasId, wallet.info);

  const collectionOutputs = await nftWallet.getNftOutputs(undefined, aliasAddress);
  const [collectionOutputId, collectionOutput] = Object.entries(collectionOutputs)[0];

  const remainder = packBasicOutput(
    targetAddress,
    Number(collectionOutput.amount),
    [],
    wallet.info,
  );

  const nextAliasOutput = cloneDeep(aliasOutput);
  nextAliasOutput.stateIndex++;

  const inputs = [aliasOutputId, collectionOutputId].map(TransactionHelper.inputFromOutputId);
  const inputsCommitment = TransactionHelper.getInputsCommitment([aliasOutput, collectionOutput]);
  const essence = packEssence(inputs, inputsCommitment, [nextAliasOutput, remainder], wallet, {});

  const address = await wallet.getAddressDetails(targetAddress);
  const blockId = await submitBlock(
    wallet,
    packPayload(essence, [
      createUnlock(essence, address.keyPair),
      { type: ALIAS_UNLOCK_TYPE, reference: 0 },
    ]),
  );
  console.log('burning collection', blockId);
  await awaitLedgerInclusionState(blockId, network);
};

const burnAlias = async (
  wallet: SmrWallet,
  aliasOutputId: string,
  targetAddress: string,
  network: Network,
) => {
  const aliasOutput = (await wallet.client.output(aliasOutputId)).output as IAliasOutput;
  const remainder = packBasicOutput(targetAddress, Number(aliasOutput.amount), [], wallet.info);

  const inputs = [aliasOutputId].map(TransactionHelper.inputFromOutputId);
  const inputsCommitment = TransactionHelper.getInputsCommitment([aliasOutput]);
  const essence = packEssence(inputs, inputsCommitment, [remainder], wallet, {});

  const address = await wallet.getAddressDetails(targetAddress);
  const blockId = await submitBlock(
    wallet,
    packPayload(essence, [createUnlock(essence, address.keyPair)]),
  );
  console.log('burning alias', blockId);
  await awaitLedgerInclusionState(blockId, network);
};

const sendBalanceToItself = async (bech32: string, wallet: SmrWallet, network: Network) => {
  const address = await wallet.getAddressDetails(bech32);
  const balance = await wallet.getBalance(address.bech32);
  const blockId = await wallet.send(address, bech32, balance, {});
  console.log('send to itself', blockId);
  await awaitLedgerInclusionState(blockId, network);
  await MnemonicService.store(address.bech32, address.mnemonic, network);
};
