import { build5Db } from '@build-5/database';
import {
  Award,
  COL,
  Collection,
  CollectionType,
  Network,
  Nft,
  NftStatus,
  Space,
  Transaction,
} from '@build-5/interfaces';
import {
  ADDRESS_UNLOCK_CONDITION_TYPE,
  ALIAS_ADDRESS_TYPE,
  ALIAS_UNLOCK_TYPE,
  AddressTypes,
  Bech32Helper,
  DEFAULT_PROTOCOL_VERSION,
  ED25519_ADDRESS_TYPE,
  IAliasOutput,
  IBasicOutput,
  IBlock,
  INftAddress,
  INftOutput,
  IndexerPluginClient,
  METADATA_FEATURE_TYPE,
  NFT_ADDRESS_TYPE,
  OutputTypes,
  REFERENCE_UNLOCK_TYPE,
  TAG_FEATURE_TYPE,
  TIMELOCK_UNLOCK_CONDITION_TYPE,
  TransactionHelper,
  UnlockTypes,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions/v2';
import { cloneDeep, get, head, isEmpty } from 'lodash';
import { getAddress } from '../../utils/address.utils';
import { mergeOutputs } from '../../utils/basic-output.utils';
import { isValidBlockSize, packEssence, packPayload, submitBlock } from '../../utils/block.utils';
import {
  EMPTY_NFT_ID,
  ZERO_ADDRESS,
  collectionToMetadata,
  createNftOutput,
  nftToMetadata,
} from '../../utils/collection-minting-utils/nft.utils';
import { createUnlock } from '../../utils/smr.utils';
import { EMPTY_ALIAS_ID, getAliasBech32Address } from '../../utils/token-minting-utils/alias.utils';
import { awardBadgeToNttMetadata, awardToCollectionMetadata } from '../payment/award/award-service';
import { SmrParams, SmrWallet } from './SmrWalletService';
import { MnemonicService } from './mnemonic';
import { AliasWallet } from './smr-wallets/AliasWallet';
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
    const sourceIsGov =
      !transaction.payload.aliasGovAddress ||
      transaction.payload.aliasGovAddress === transaction.payload.sourceAddress;

    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const outputsMap = await this.wallet.getOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedOutputIds,
      false,
    );
    const remainder = mergeOutputs(Object.values(outputsMap));

    const aliasGovAddress = await this.wallet.getAddressDetails(
      transaction.payload.aliasGovAddress || sourceAddress.bech32,
    );

    const aliasGovMnemonic = sourceIsGov
      ? sourceMnemonic
      : await MnemonicService.getData(aliasGovAddress.bech32);
    const aliasWallet = new AliasWallet(this.wallet);
    const aliasOutputs = await aliasWallet.getAliasOutputs(
      aliasGovAddress.bech32,
      aliasGovMnemonic.consumedAliasOutputIds,
    );
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0];
    const nextAliasOutput = cloneDeep(aliasOutput);
    if (nextAliasOutput.aliasId === EMPTY_ALIAS_ID) {
      nextAliasOutput.aliasId = TransactionHelper.resolveIdFromOutputId(aliasOutputId);
    }
    nextAliasOutput.stateIndex++;

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${transaction.payload.collection}`);
    const collection = <Collection>await collectionDocRef.get();

    const collectionMetadata = await this.getCollectionMetadata(transaction.network!, collection);
    const issuerAddress: AddressTypes = {
      type: ALIAS_ADDRESS_TYPE,
      aliasId: nextAliasOutput.aliasId,
    };
    const collectionOutput = createNftOutput(
      issuerAddress,
      issuerAddress,
      collectionMetadata.immutableMetadata,
      this.wallet.info,
      undefined,
      collectionMetadata.mutableMetadata,
    );
    remainder.amount = (Number(remainder.amount) - Number(collectionOutput.amount)).toString();

    const inputs = [aliasOutputId, ...Object.keys(outputsMap)].map(
      TransactionHelper.inputFromOutputId,
    );
    const inputsCommitment = TransactionHelper.getInputsCommitment([
      aliasOutput,
      ...Object.values(outputsMap),
    ]);
    const outputs = Number(remainder.amount)
      ? [nextAliasOutput, collectionOutput, remainder]
      : [nextAliasOutput, collectionOutput];
    const essence = packEssence(inputs, inputsCommitment, outputs, this.wallet, params);
    const unlocks: UnlockTypes[] = [
      createUnlock(essence, aliasGovAddress.keyPair),
      sourceIsGov
        ? { type: REFERENCE_UNLOCK_TYPE, reference: 0 }
        : createUnlock(essence, sourceAddress.keyPair),
    ];

    await setConsumedOutputIds(
      sourceAddress.bech32,
      Object.keys(outputsMap),
      [],
      sourceIsGov ? [aliasOutputId] : [],
    );
    if (!sourceIsGov) {
      await setConsumedOutputIds(aliasGovAddress.bech32, [], [], [aliasOutputId]);
    }
    return await submitBlock(this.wallet, packPayload(essence, unlocks));
  };

  private getCollectionMetadata = async (network: Network, collection: Collection) => {
    if (collection.type === CollectionType.METADATA) {
      return { immutableMetadata: '', mutableMetadata: '' };
    }
    const royaltySpaceDocRef = build5Db().doc(`${COL.SPACE}/${collection.royaltiesSpace}`);
    const royaltySpace = <Space>await royaltySpaceDocRef.get();
    const royaltySpaceAddress = getAddress(royaltySpace, network);
    const collectionMetadata = await collectionToMetadata(collection, royaltySpaceAddress);
    return { immutableMetadata: JSON.stringify(collectionMetadata), mutableMetadata: '' };
  };

  public mintAwardCollection = async (transaction: Transaction, params: SmrParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const outputsMap = await this.wallet.getOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedOutputIds,
      false,
    );
    const remainder = mergeOutputs(Object.values(outputsMap));

    const aliasWallet = new AliasWallet(this.wallet);
    const aliasOutputs = await aliasWallet.getAliasOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedAliasOutputIds,
    );
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0];
    const nextAliasOutput = cloneDeep(aliasOutput);
    nextAliasOutput.aliasId = TransactionHelper.resolveIdFromOutputId(aliasOutputId);
    nextAliasOutput.stateIndex++;

    const awardDocRef = build5Db().doc(`${COL.AWARD}/${transaction.payload.award}`);
    const award = <Award>await awardDocRef.get();

    const issuerAddress: AddressTypes = {
      type: ALIAS_ADDRESS_TYPE,
      aliasId: TransactionHelper.resolveIdFromOutputId(aliasOutputId),
    };
    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${award.space}`);
    const space = <Space>await spaceDocRef.get();
    const metadata = await awardToCollectionMetadata(award, space);
    const collectionOutput = createNftOutput(
      issuerAddress,
      issuerAddress,
      JSON.stringify(metadata),
      this.wallet.info,
    );

    remainder.amount = (Number(remainder.amount) - Number(collectionOutput.amount)).toString();

    const inputs = [aliasOutputId, ...Object.keys(outputsMap)].map(
      TransactionHelper.inputFromOutputId,
    );
    const inputsCommitment = TransactionHelper.getInputsCommitment([
      aliasOutput,
      ...Object.values(outputsMap),
    ]);
    const outputs = [nextAliasOutput, collectionOutput, remainder];
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
      await build5Db().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).get()
    );
    const royaltySpace = <Space>(
      await build5Db().doc(`${COL.SPACE}/${collection.royaltiesSpace}`).get()
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
    const batch = build5Db().batch();
    nftOutputsToMint.forEach((output, i) => {
      batch.update(build5Db().doc(`${COL.NFT}/${nfts[i].uid}`), {
        'mintingData.address': nftMintAddresses[i].bech32,
        'mintingData.storageDeposit': Number(output.amount),
      });
    });
    await batch.commit();
    await build5Db()
      .doc(`${COL.TRANSACTION}/${transaction.uid}`)
      .update({
        'payload.amount': nftOutputsToMint.reduce((acc, act) => acc + Number(act.amount), 0),
        'payload.nfts': nfts.slice(0, nftsToMint).map((nft) => nft.uid),
      });

    await setConsumedOutputIds(
      sourceAddress.bech32,
      Object.keys(outputsMap),
      [collectionOutputId],
      [],
    );
    const block = this.packNftMintBlock(sourceAddress, inputs, nftOutputsToMint, params);
    return await this.wallet.client.blockSubmit(block);
  };

  public mintNtt = async (transaction: Transaction, params: SmrParams) => {
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

    const awardDocRef = build5Db().doc(`${COL.AWARD}/${transaction.payload.award}`);
    const award = <Award>await awardDocRef.get();

    const issuerAddress: INftAddress = { type: NFT_ADDRESS_TYPE, nftId: collectionNftId };
    const ownerAddress = Bech32Helper.addressFromBech32(
      transaction.payload.targetAddress!,
      this.wallet.info.protocol.bech32Hrp,
    );

    const metadata = await awardBadgeToNttMetadata(
      award,
      collectionNftId,
      transaction.uid,
      dayjs(get(transaction, 'payload.participatedOn')!.toDate()),
      get(transaction, 'payload.edition', 0),
    );
    const ntt = createNftOutput(
      ownerAddress,
      issuerAddress,
      JSON.stringify(metadata),
      this.wallet.info,
      dayjs().add(award.badge.lockTime),
    );

    const inputs: MintNftInputParams = {
      aliasOutputId,
      aliasOutput,
      collectionOutputId,
      collectionOutput,
      consumedOutputIds: Object.keys(outputsMap),
      consumedOutputs: Object.values(outputsMap),
    };

    await setConsumedOutputIds(
      sourceAddress.bech32,
      Object.keys(outputsMap),
      [collectionOutputId],
      [aliasOutputId],
    );
    const block = this.packNftMintBlock(sourceAddress, inputs, [ntt], params);
    return await this.wallet.client.blockSubmit(block);
  };

  public mintMetadataNft = async (transaction: Transaction, params: SmrParams) => {
    const sourceIsGov =
      !transaction.payload.aliasGovAddress ||
      transaction.payload.aliasGovAddress === transaction.payload.sourceAddress;

    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const outputsMap = await this.wallet.getOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedOutputIds,
      false,
    );

    const indexer = new IndexerPluginClient(this.wallet.client);

    const aliasGovAddress = await this.wallet.getAddressDetails(
      transaction.payload.aliasGovAddress,
    );
    const aliasGovMnemonic = sourceIsGov
      ? sourceMnemonic
      : await MnemonicService.getData(aliasGovAddress.bech32);
    const aliasWallet = new AliasWallet(this.wallet);
    const aliasOutputs = await aliasWallet.getAliasOutputs(
      aliasGovAddress.bech32,
      aliasGovMnemonic.consumedAliasOutputIds,
    );
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0];

    const collectionResult = await indexer.nft(transaction.payload.collectionId!);
    const collectionOutputId = collectionResult.items[0];
    const collectionOutput = (await this.wallet.client.output(collectionOutputId))
      .output as INftOutput;

    const inputs = [aliasOutputId, collectionOutputId, ...Object.keys(outputsMap)].map(
      TransactionHelper.inputFromOutputId,
    );
    const inputsCommitment = TransactionHelper.getInputsCommitment([
      aliasOutput,
      collectionOutput,
      ...Object.values(outputsMap),
    ]);
    const nextAliasOutput = cloneDeep(aliasOutput);
    nextAliasOutput.stateIndex++;
    const nextCollectionOutput = cloneDeep(collectionOutput);
    if (nextCollectionOutput.nftId === EMPTY_NFT_ID) {
      nextCollectionOutput.nftId = TransactionHelper.resolveIdFromOutputId(collectionOutputId);
    }

    const order = await build5Db()
      .doc(`${COL.TRANSACTION}/${transaction.payload.orderId}`)
      .get<Transaction>();
    const issuerAddress: INftAddress = {
      type: NFT_ADDRESS_TYPE,
      nftId: transaction.payload.collectionId!,
    };
    const ownerAddress = Bech32Helper.addressFromBech32(
      transaction.payload.targetAddress!,
      this.wallet.info.protocol.bech32Hrp,
    );
    const mutableMetadata = JSON.stringify(get(order, 'payload.metadata', {}));
    const nftOutput = createNftOutput(
      ownerAddress,
      issuerAddress,
      '',
      this.wallet.info,
      undefined,
      mutableMetadata,
    );

    const remainder = mergeOutputs(Object.values(outputsMap));
    remainder.amount = (Number(remainder.amount) - Number(nftOutput.amount)).toString();

    const outputs: OutputTypes[] = [nextAliasOutput, nextCollectionOutput, nftOutput];
    if (Number(remainder.amount)) {
      outputs.push(remainder);
    }

    const essence = packEssence(inputs, inputsCommitment, outputs, this.wallet, params);
    const unlocks: UnlockTypes[] = [
      createUnlock(essence, aliasGovAddress.keyPair),
      { type: ALIAS_UNLOCK_TYPE, reference: 0 },
      sourceIsGov
        ? { type: REFERENCE_UNLOCK_TYPE, reference: 0 }
        : createUnlock(essence, sourceAddress.keyPair),
    ];

    await setConsumedOutputIds(
      sourceAddress.bech32,
      Object.keys(outputsMap),
      sourceIsGov ? [collectionOutputId] : [],
      sourceIsGov ? [aliasOutputId] : [],
    );
    if (!sourceIsGov) {
      await setConsumedOutputIds(aliasGovAddress.bech32, [], [collectionOutputId], [aliasOutputId]);
    }
    return await submitBlock(this.wallet, packPayload(essence, unlocks));
  };

  public updateMetadataNft = async (transaction: Transaction, params: SmrParams) => {
    const sourceIsGov =
      !transaction.payload.aliasGovAddress ||
      transaction.payload.aliasGovAddress === transaction.payload.sourceAddress;

    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const outputsMap = await this.wallet.getOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedOutputIds,
      false,
    );
    const [consumedOutputId, consumedOutput] = Object.entries(outputsMap)[0];

    const indexer = new IndexerPluginClient(this.wallet.client);

    const aliasGovAddress = await this.wallet.getAddressDetails(
      transaction.payload.aliasGovAddress,
    );
    const aliasGovMnemonic = sourceIsGov
      ? sourceMnemonic
      : await MnemonicService.getData(aliasGovAddress.bech32);
    const aliasWallet = new AliasWallet(this.wallet);
    const aliasOutputs = await aliasWallet.getAliasOutputs(
      aliasGovAddress.bech32,
      aliasGovMnemonic.consumedAliasOutputIds,
    );
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0];

    const collectionResult = await indexer.nft(transaction.payload.collectionId!);
    const collectionOutputId = collectionResult.items[0];
    const collectionOutput = (await this.wallet.client.output(collectionOutputId))
      .output as INftOutput;

    const nft = <Nft>await build5Db().doc(`${COL.NFT}/${transaction.payload.nft}`).get();
    const nftOwnerAddressBech = nft.mintingData?.address || nft.depositData?.address!;
    const nftOwnerAddress = await this.wallet.getAddressDetails(nftOwnerAddressBech);
    const nftResult = await indexer.nft(nft.mintingData?.nftId!);
    const nftOutputId = nftResult.items[0];
    const nftOutput = (await this.wallet.client.output(nftOutputId)).output as INftOutput;

    const inputs = [aliasOutputId, collectionOutputId, nftOutputId, consumedOutputId].map(
      TransactionHelper.inputFromOutputId,
    );
    const inputsCommitment = TransactionHelper.getInputsCommitment([
      aliasOutput,
      collectionOutput,
      nftOutput,
      consumedOutput,
    ]);
    const nextAliasOutput = cloneDeep(aliasOutput);
    nextAliasOutput.stateIndex++;
    const nextCollectionOutput = cloneDeep(collectionOutput);
    if (nextCollectionOutput.nftId === EMPTY_NFT_ID) {
      nextCollectionOutput.nftId = TransactionHelper.resolveIdFromOutputId(collectionOutputId);
    }

    const order = await build5Db()
      .doc(`${COL.TRANSACTION}/${transaction.payload.orderId}`)
      .get<Transaction>();
    const mutableMetadata = JSON.stringify(get(order, 'payload.metadata', {}));
    const nextNftOutput = cloneDeep(nftOutput);
    if (nextNftOutput.nftId === EMPTY_NFT_ID) {
      nextNftOutput.nftId = TransactionHelper.resolveIdFromOutputId(nftOutputId);
    }
    nextNftOutput.features = [
      { type: METADATA_FEATURE_TYPE, data: Converter.utf8ToHex(mutableMetadata, true) },
    ];
    nextNftOutput.amount = TransactionHelper.getStorageDeposit(
      nextNftOutput,
      this.wallet.info.protocol.rentStructure,
    ).toString();

    const remainder = cloneDeep(consumedOutput);
    remainder.amount = (
      Number(remainder.amount) +
      Number(nftOutput.amount) -
      Number(nextNftOutput.amount)
    ).toString();

    const outputs: OutputTypes[] = [nextAliasOutput, nextCollectionOutput, nextNftOutput];
    if (Number(remainder.amount)) {
      outputs.push(remainder);
    }

    const essence = packEssence(inputs, inputsCommitment, outputs, this.wallet, params);
    const unlocks: UnlockTypes[] = [
      createUnlock(essence, aliasGovAddress.keyPair),
      { type: ALIAS_UNLOCK_TYPE, reference: 0 },
      aliasGovAddress.bech32 === nftOwnerAddressBech
        ? { type: REFERENCE_UNLOCK_TYPE, reference: 0 }
        : createUnlock(essence, nftOwnerAddress.keyPair),
      sourceIsGov
        ? { type: REFERENCE_UNLOCK_TYPE, reference: 0 }
        : createUnlock(essence, sourceAddress.keyPair),
    ];

    await setConsumedOutputIds(
      sourceAddress.bech32,
      Object.keys(outputsMap),
      sourceIsGov ? [collectionOutputId] : [],
      sourceIsGov ? [aliasOutputId] : [],
    );
    if (!sourceIsGov) {
      await setConsumedOutputIds(aliasGovAddress.bech32, [], [collectionOutputId], [aliasOutputId]);
    }
    return await submitBlock(this.wallet, packPayload(essence, unlocks));
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
    const remainder = mergeOutputs(input.consumedOutputs);
    remainder.amount = (Number(remainder.amount) - nftTotalStorageDeposit).toString();

    const outputs = [nextAliasOutput, nextCollectionOutput, ...nftOutputs];
    const essence = packEssence(
      inputs,
      inputsCommitment,
      Number(remainder.amount) ? [...outputs, remainder] : outputs,
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
      transaction.payload.nftId || undefined,
      transaction.payload.sourceAddress,
      sourceMnemonic.consumedNftOutputIds,
    );

    const nftOutput = Object.values(nftOutputs)[0];

    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress);
    const targetAddress = Bech32Helper.addressFromBech32(
      transaction.payload.targetAddress!,
      this.wallet.info.protocol.bech32Hrp,
    );
    const output = cloneDeep(nftOutput);
    output.features = output.features?.filter((f) => f.type !== TAG_FEATURE_TYPE);
    output.unlockConditions = [{ type: ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }];

    const vestingAt = dayjs(transaction.payload.vestingAt?.toDate());
    if (vestingAt.isAfter(dayjs())) {
      output.unlockConditions.push({
        type: TIMELOCK_UNLOCK_CONDITION_TYPE,
        unixTime: vestingAt.unix(),
      });
    }

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

  public getById = async (nftId: string) => {
    const indexer = new IndexerPluginClient(this.wallet.client);
    const indexerResponse = await indexer.nft(nftId);
    const outputResponse = await this.wallet.client.output(indexerResponse.items[0]);
    return outputResponse.output as INftOutput;
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

const getPreMintedNfts = (collection: string, limit = 100) =>
  build5Db()
    .collection(COL.NFT)
    .where('collection', '==', collection)
    .where('status', '==', NftStatus.PRE_MINTED)
    .where('placeholderNft', '==', false)
    .limit(limit)
    .get<Nft>();
