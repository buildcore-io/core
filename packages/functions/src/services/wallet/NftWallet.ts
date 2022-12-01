import {
  AddressTypes,
  ADDRESS_UNLOCK_CONDITION_TYPE,
  ALIAS_ADDRESS_TYPE,
  ALIAS_UNLOCK_TYPE,
  Bech32Helper,
  DEFAULT_PROTOCOL_VERSION,
  ED25519_ADDRESS_TYPE,
  IAliasOutput,
  IBasicOutput,
  IBlock,
  IndexerPluginClient,
  INftAddress,
  INftOutput,
  NFT_ADDRESS_TYPE,
  REFERENCE_UNLOCK_TYPE,
  TransactionHelper,
  UnlockTypes,
} from '@iota/iota.js-next';
import { COL, Collection, Nft, NftStatus, Space, Transaction } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { cloneDeep, head, isEmpty } from 'lodash';
import admin from '../../admin.config';
import { getAddress } from '../../utils/address.utils';
import { packBasicOutput } from '../../utils/basic-output.utils';
import { isValidBlockSize, packEssence, packPayload, submitBlock } from '../../utils/block.utils';
import {
  collectionToMetadata,
  createNftOutput,
  EMPTY_NFT_ID,
  nftToMetadata,
  ZERO_ADDRESS,
} from '../../utils/collection-minting-utils/nft.utils';
import { uOn } from '../../utils/dateTime.utils';
import { createUnlock } from '../../utils/smr.utils';
import { getAliasBech32Address } from '../../utils/token-minting-utils/alias.utils';
import { MnemonicService } from './mnemonic';
import { AliasWallet } from './smr-wallets/AliasWallet';
import { SmrParams, SmrWallet } from './SmrWalletService';
import { AddressDetails, setConsumedOutputIds } from './wallet';

interface MintNftInputParams {
  readonly aliasOutputId: string;
  readonly aliasOutput: IAliasOutput;
  readonly collectionOutputId: string;
  readonly collectionOutput: INftOutput;
  readonly consumedOutputIds: string[];
  readonly consumedOutputs: IBasicOutput[];
}

export class NftWallet {
  constructor(private readonly wallet: SmrWallet) {}

  public mintCollection = async (transaction: Transaction, params: SmrParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const outputsMap = await this.wallet.getOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedOutputIds,
      false,
    );
    const totalAmount = Object.values(outputsMap).reduce((acc, act) => acc + Number(act.amount), 0);

    const aliasWallet = new AliasWallet(this.wallet);
    const aliasOutputs = await aliasWallet.getAliasOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedAliasOutputIds,
    );
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0];
    const nextAliasOutput = cloneDeep(aliasOutput);
    nextAliasOutput.aliasId = TransactionHelper.resolveIdFromOutputId(aliasOutputId);
    nextAliasOutput.stateIndex++;

    const collection = <Collection>(
      (
        await admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).get()
      ).data()
    );
    const royaltySpace = <Space>(
      (await admin.firestore().doc(`${COL.SPACE}/${collection.royaltiesSpace}`).get()).data()
    );
    const royaltySpaceAddress = getAddress(royaltySpace, transaction.network!);

    const issuerAddress: AddressTypes = {
      type: ALIAS_ADDRESS_TYPE,
      aliasId: TransactionHelper.resolveIdFromOutputId(aliasOutputId),
    };
    const collectionMetadata = await collectionToMetadata(collection, royaltySpaceAddress);
    const collectionOutput = createNftOutput(
      issuerAddress,
      issuerAddress,
      JSON.stringify(collectionMetadata),
      this.wallet.info,
    );

    const remainderAmount = totalAmount - Number(collectionOutput.amount);
    const remainder = packBasicOutput(sourceAddress.bech32, remainderAmount, [], this.wallet.info);

    const inputs = [aliasOutputId, ...Object.keys(outputsMap)].map(
      TransactionHelper.inputFromOutputId,
    );
    const inputsCommitment = TransactionHelper.getInputsCommitment([
      aliasOutput,
      ...Object.values(outputsMap),
    ]);
    const outputs = remainderAmount
      ? [nextAliasOutput, collectionOutput, remainder]
      : [nextAliasOutput, collectionOutput];
    const essence = packEssence(inputs, inputsCommitment, outputs, this.wallet, params);
    const unlocks: UnlockTypes[] = [
      createUnlock(essence, sourceAddress.keyPair),
      { type: REFERENCE_UNLOCK_TYPE, reference: 0 },
    ];

    await setConsumedOutputIds(sourceAddress.bech32, Object.keys(outputsMap));
    return await submitBlock(this.wallet, packPayload(essence, unlocks));
  };

  public mintNfts = async (transaction: Transaction, params: SmrParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const outputsMap = await this.wallet.getOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedOutputIds,
      false,
    );

    const aliasWallet = new AliasWallet(this.wallet);
    const aliasOutputs = await aliasWallet.getAliasOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedAliasOutputIds,
    );
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0];

    const aliasAddress = getAliasBech32Address(aliasOutput.aliasId, this.wallet.info);
    const collectionOutputs = await this.getNftOutputs(
      undefined,
      aliasAddress,
      sourceMnemonic.consumedNftOutputIds,
    );
    const [collectionOutputId, collectionOutput] = Object.entries(collectionOutputs)[0];
    const collectionNftId =
      collectionOutput.nftId === EMPTY_NFT_ID
        ? TransactionHelper.resolveIdFromOutputId(collectionOutputId)
        : collectionOutput.nftId;

    const collection = <Collection>(
      (
        await admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).get()
      ).data()
    );
    const royaltySpace = <Space>(
      (await admin.firestore().doc(`${COL.SPACE}/${collection.royaltiesSpace}`).get()).data()
    );
    const royaltySpaceAddress = getAddress(royaltySpace, transaction.network!);

    const nfts = await getPreMintedNfts(transaction.payload.collection as string);
    const nftMintAddresses = await getNftMintingAddress(nfts, this.wallet);
    const promises = nfts.map((nft, index) =>
      this.packNft(nft, collection, royaltySpaceAddress, nftMintAddresses[index], collectionNftId),
    );
    const nftOutputs = await Promise.all(promises);
    const inputs: MintNftInputParams = {
      aliasOutputId,
      aliasOutput,
      collectionOutputId,
      collectionOutput,
      consumedOutputIds: Object.keys(outputsMap),
      consumedOutputs: Object.values(outputsMap),
    };

    let nftsToMint = nfts.length;
    do {
      try {
        const block = this.packNftMintBlock(
          sourceAddress,
          inputs,
          nftOutputs.slice(0, nftsToMint),
          params,
        );
        if (isValidBlockSize(block)) {
          break;
        }
        // eslint-disable-next-line no-empty
      } catch {}
      nftsToMint--;
    } while (nftsToMint > 0);

    if (!nftsToMint) {
      functions.logger.error('Nft data to big to mint', head(nfts));
      throw Error('Nft data to big to mint');
    }

    const nftOutputsToMint = nftOutputs.slice(0, nftsToMint);
    const batch = admin.firestore().batch();
    nftOutputsToMint.forEach((output, i) => {
      batch.update(
        admin.firestore().doc(`${COL.NFT}/${nfts[i].uid}`),
        uOn({
          'mintingData.address': nftMintAddresses[i].bech32,
          'mintingData.storageDeposit': Number(output.amount),
        }),
      );
    });
    await batch.commit();
    await admin
      .firestore()
      .doc(`${COL.TRANSACTION}/${transaction.uid}`)
      .update(
        uOn({
          'payload.amount': nftOutputsToMint.reduce((acc, act) => acc + Number(act.amount), 0),
          'payload.nfts': nfts.slice(0, nftsToMint).map((nft) => nft.uid),
        }),
      );

    await setConsumedOutputIds(
      sourceAddress.bech32,
      Object.keys(outputsMap),
      [collectionOutputId],
      [],
    );
    const block = this.packNftMintBlock(sourceAddress, inputs, nftOutputsToMint, params);
    return await this.wallet.client.blockSubmit(block);
  };

  public packNftMintBlock = (
    address: AddressDetails,
    input: MintNftInputParams,
    nftOutputs: INftOutput[],
    params: SmrParams,
  ) => {
    const inputs = [input.aliasOutputId, input.collectionOutputId, ...input.consumedOutputIds].map(
      TransactionHelper.inputFromOutputId,
    );
    const inputsCommitment = TransactionHelper.getInputsCommitment([
      input.aliasOutput,
      input.collectionOutput,
      ...input.consumedOutputs,
    ]);
    const nextAliasOutput = cloneDeep(input.aliasOutput);
    nextAliasOutput.stateIndex++;
    const nextCollectionOutput = cloneDeep(input.collectionOutput);
    if (nextCollectionOutput.nftId === EMPTY_NFT_ID) {
      nextCollectionOutput.nftId = TransactionHelper.resolveIdFromOutputId(
        input.collectionOutputId,
      );
    }

    const nftTotalStorageDeposit = nftOutputs.reduce((acc, act) => acc + Number(act.amount), 0);
    const consumedTotal = input.consumedOutputs.reduce((acc, act) => acc + Number(act.amount), 0);
    const remainderAmount = consumedTotal - nftTotalStorageDeposit;
    const reminder = remainderAmount
      ? packBasicOutput(address.bech32, remainderAmount, [], this.wallet.info)
      : undefined;

    const outputs = [nextAliasOutput, nextCollectionOutput, ...nftOutputs];
    const essence = packEssence(
      inputs,
      inputsCommitment,
      reminder ? [...outputs, reminder] : outputs,
      this.wallet,
      params,
    );
    const unlocks: UnlockTypes[] = [
      createUnlock(essence, address.keyPair),
      { type: ALIAS_UNLOCK_TYPE, reference: 0 },
      ...input.consumedOutputIds.map(
        () => ({ type: REFERENCE_UNLOCK_TYPE, reference: 0 } as UnlockTypes),
      ),
    ];
    return <IBlock>{
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
      parents: [],
      payload: packPayload(essence, unlocks),
      nonce: '0',
    };
  };

  public packNft = async (
    nft: Nft,
    collection: Collection,
    royaltySpaceAddress: string,
    address: AddressDetails,
    collectionNftId: string,
  ) => {
    const issuerAddress: INftAddress = { type: NFT_ADDRESS_TYPE, nftId: collectionNftId };
    const ownerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: address.hex };
    const metadata = JSON.stringify(
      await nftToMetadata(nft, collection, royaltySpaceAddress, collectionNftId),
    );
    return createNftOutput(ownerAddress, issuerAddress, metadata, this.wallet.info);
  };

  public changeNftOwner = async (transaction: Transaction, params: SmrParams) => {
    const sourceMnemonic = await MnemonicService.getData(transaction.payload.sourceAddress);
    const nftOutputs = await this.getNftOutputs(
      transaction.payload.nftId,
      transaction.payload.sourceAddress,
      sourceMnemonic.consumedNftOutputIds,
    );

    const nftOutput = Object.values(nftOutputs)[0];

    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress);
    const targetAddress = Bech32Helper.addressFromBech32(
      transaction.payload.targetAddress,
      this.wallet.info.protocol.bech32Hrp,
    );
    const output = cloneDeep(nftOutput);
    output.unlockConditions = [{ type: ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }];

    if (output.nftId === EMPTY_NFT_ID) {
      output.nftId = TransactionHelper.resolveIdFromOutputId(Object.keys(nftOutputs)[0]);
    }

    const inputs = Object.keys(nftOutputs).map(TransactionHelper.inputFromOutputId);
    const inputsCommitment = TransactionHelper.getInputsCommitment(Object.values(nftOutputs));
    const essence = packEssence(inputs, inputsCommitment, [output], this.wallet, params);

    await setConsumedOutputIds(sourceAddress.bech32, [], Object.keys(nftOutputs));
    return await submitBlock(
      this.wallet,
      packPayload(essence, [createUnlock(essence, sourceAddress.keyPair)]),
    );
  };

  public lockCollection = async (transaction: Transaction, params: SmrParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const aliasWallet = new AliasWallet(this.wallet);
    const aliasOutputs = await aliasWallet.getAliasOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedAliasOutputIds,
    );
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0];

    const nextAliasOutput = cloneDeep(aliasOutput);
    nextAliasOutput.stateIndex++;

    const aliasAddress = getAliasBech32Address(aliasOutput.aliasId, this.wallet.info);
    const collectionOutputs = await this.getNftOutputs(
      undefined,
      aliasAddress,
      sourceMnemonic.consumedNftOutputIds,
    );
    const [collectionOutputId, collectionOutput] = Object.entries(collectionOutputs)[0];
    const nextCollectionOutput = cloneDeep(collectionOutput);
    nextCollectionOutput.unlockConditions = [
      { type: ADDRESS_UNLOCK_CONDITION_TYPE, address: ZERO_ADDRESS },
    ];

    const inputs = [aliasOutputId, collectionOutputId].map(TransactionHelper.inputFromOutputId);
    const inputsCommitment = TransactionHelper.getInputsCommitment([aliasOutput, collectionOutput]);
    const outputs = [nextAliasOutput, nextCollectionOutput];
    const essence = packEssence(inputs, inputsCommitment, outputs, this.wallet, params);
    const unlocks: UnlockTypes[] = [
      createUnlock(essence, sourceAddress.keyPair),
      { type: ALIAS_UNLOCK_TYPE, reference: 0 },
    ];

    await setConsumedOutputIds(sourceAddress.bech32, [], [collectionOutputId], [aliasOutputId]);
    return await submitBlock(this.wallet, packPayload(essence, unlocks));
  };

  public getNftOutputs = async (
    nftId: string | undefined,
    sourceAddress: string | undefined,
    prevConsumedNftOutputId: string[] = [],
  ) => {
    const outputIds = await this.getNftOutputIds(nftId, sourceAddress, prevConsumedNftOutputId);
    const outputs: { [key: string]: INftOutput } = {};
    for (const id of outputIds) {
      const output = (await this.wallet.client.output(id)).output;
      outputs[id] = output as INftOutput;
    }
    return outputs;
  };

  private getNftOutputIds = async (
    nftId: string | undefined,
    sourceAddress: string | undefined,
    prevConsumedNftOutputId: string[] = [],
  ) => {
    const indexer = new IndexerPluginClient(this.wallet.client);
    if (!isEmpty(prevConsumedNftOutputId)) {
      return prevConsumedNftOutputId;
    }
    if (nftId) {
      return (await indexer.nft(nftId)).items;
    }
    const items = (await indexer.nfts({ addressBech32: sourceAddress })).items;
    return isEmpty(items) ? [] : [items[0]];
  };
}

const getNftMintingAddress = (nfts: Nft[], wallet: SmrWallet) => {
  const promises = nfts.map(async (nft) =>
    nft.mintingData?.address
      ? await wallet.getAddressDetails(nft.mintingData?.address)
      : await wallet.getNewIotaAddressDetails(),
  );
  return Promise.all(promises);
};

const getPreMintedNfts = async (collection: string, limit = 100) => {
  const snap = await admin
    .firestore()
    .collection(COL.NFT)
    .where('collection', '==', collection)
    .where('status', '==', NftStatus.PRE_MINTED)
    .where('placeholderNft', '==', false)
    .limit(limit)
    .get();
  return snap.docs.map((d) => <Nft>d.data());
};
