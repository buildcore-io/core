import { build5Db } from '@build-5/database';
import {
  Award,
  COL,
  Collection,
  CollectionType,
  Network,
  NetworkAddress,
  Nft,
  NftStatus,
  Space,
  Stamp,
  Transaction,
} from '@build-5/interfaces';
import {
  AddressUnlockCondition,
  AliasAddress,
  AliasOutput,
  AliasOutputBuilderParams,
  AliasUnlock,
  BasicOutput,
  BasicOutputBuilderParams,
  Client,
  Ed25519Address,
  FeatureType,
  MetadataFeature,
  NftAddress,
  NftOutput,
  NftOutputBuilderParams,
  Output,
  ReferenceUnlock,
  TimelockUnlockCondition,
  UTXOInput,
  Unlock,
  Utils,
  utf8ToHex,
} from '@iota/sdk';
import dayjs from 'dayjs';
import { cloneDeep, get, head, isEmpty } from 'lodash';
import { unclockMnemonic } from '../../triggers/milestone-transactions-triggers/common';
import { getAddress } from '../../utils/address.utils';
import { mergeOutputs } from '../../utils/basic-output.utils';
import { createUnlock, packEssence, submitBlock } from '../../utils/block.utils';
import {
  EMPTY_NFT_ID,
  ZERO_ADDRESS,
  collectionToMetadata,
  createNftOutput,
  nftToMetadata,
} from '../../utils/collection-minting-utils/nft.utils';
import { EMPTY_ALIAS_ID } from '../../utils/token-minting-utils/alias.utils';
import { awardBadgeToNttMetadata, awardToCollectionMetadata } from '../payment/award/award-service';
import { stampToNftMetadata } from '../payment/tangle-service/stamp/StampTangleService';
import { AliasWallet } from './AliasWallet';
import { MnemonicService } from './mnemonic';
import { Wallet, WalletParams } from './wallet';
import { AddressDetails, setConsumedOutputIds } from './wallet.service';

interface MintNftInputParams {
  readonly aliasOutputId: string;
  readonly aliasOutput: AliasOutput;
  readonly collectionOutputId: string;
  readonly collectionOutput: NftOutput;
  readonly consumedOutputIds: string[];
  readonly consumedOutputs: BasicOutput[];
}

export class NftWallet {
  private client: Client;
  constructor(private readonly wallet: Wallet) {
    this.client = this.wallet.client;
  }

  public mintCollection = async (transaction: Transaction, params: WalletParams) => {
    const sourceIsGov =
      !transaction.payload.aliasGovAddress ||
      transaction.payload.aliasGovAddress === transaction.payload.sourceAddress;

    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress!);
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
    const nextAliasOutput: AliasOutputBuilderParams = cloneDeep(aliasOutput);
    if (nextAliasOutput.aliasId === EMPTY_ALIAS_ID) {
      nextAliasOutput.aliasId = Utils.computeAliasId(aliasOutputId);
    }
    nextAliasOutput.stateIndex!++;

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${transaction.payload.collection}`);
    const collection = <Collection>await collectionDocRef.get();

    const collectionMetadata = await this.getCollectionMetadata(transaction.network!, collection);
    const issuerAddress = new AliasAddress(nextAliasOutput.aliasId);
    const collectionOutput = await createNftOutput(
      this.wallet,
      issuerAddress,
      issuerAddress,
      collectionMetadata.immutableMetadata,
      undefined,
      collectionMetadata.mutableMetadata,
    );
    remainder.amount = (Number(remainder.amount) - Number(collectionOutput.amount)).toString();

    const inputs = [aliasOutputId, ...Object.keys(outputsMap)].map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment([
      aliasOutput,
      ...Object.values(outputsMap),
    ]);
    const outputs: Output[] = [
      await this.client.buildAliasOutput(nextAliasOutput),
      collectionOutput,
    ];
    if (Number(remainder.amount)) {
      outputs.push(await this.client.buildBasicOutput(remainder));
    }
    const essence = await packEssence(this.wallet, inputs, inputsCommitment, outputs, params);
    const unlocks: Unlock[] = [
      await createUnlock(essence, aliasGovAddress),
      sourceIsGov ? new ReferenceUnlock(0) : await createUnlock(essence, sourceAddress),
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
    return await submitBlock(this.wallet, essence, unlocks);
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

  public mintAwardCollection = async (transaction: Transaction, params: WalletParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress!);
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
    const nextAliasOutput: AliasOutputBuilderParams = cloneDeep(aliasOutput);
    nextAliasOutput.aliasId = Utils.computeAliasId(aliasOutputId);
    nextAliasOutput.stateIndex!++;

    const awardDocRef = build5Db().doc(`${COL.AWARD}/${transaction.payload.award}`);
    const award = <Award>await awardDocRef.get();

    const issuerAddress = new AliasAddress(Utils.computeAliasId(aliasOutputId));
    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${award.space}`);
    const space = <Space>await spaceDocRef.get();
    const metadata = await awardToCollectionMetadata(award, space);
    const collectionOutput = await createNftOutput(
      this.wallet,
      issuerAddress,
      issuerAddress,
      JSON.stringify(metadata),
    );

    remainder.amount = (Number(remainder.amount) - Number(collectionOutput.amount)).toString();

    const inputs = [aliasOutputId, ...Object.keys(outputsMap)].map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment([
      aliasOutput,
      ...Object.values(outputsMap),
    ]);
    const outputs = [
      await this.client.buildAliasOutput(nextAliasOutput),
      collectionOutput,
      await this.client.buildBasicOutput(remainder),
    ];
    const essence = await packEssence(this.wallet, inputs, inputsCommitment, outputs, params);
    const unlocks: Unlock[] = [await createUnlock(essence, sourceAddress), new ReferenceUnlock(0)];

    await setConsumedOutputIds(sourceAddress.bech32, Object.keys(outputsMap));
    return await submitBlock(this.wallet, essence, unlocks);
  };

  public mintNfts = async (transaction: Transaction, params: WalletParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress!);
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

    const aliasAddress = Utils.aliasIdToBech32(
      aliasOutput.aliasId,
      this.wallet.info.protocol.bech32Hrp,
    );
    const collectionOutputs = await this.getNftOutputs(
      undefined,
      aliasAddress,
      sourceMnemonic.consumedNftOutputIds,
    );
    const [collectionOutputId, collectionOutput] = Object.entries(collectionOutputs)[0];
    const collectionNftId =
      collectionOutput.nftId === EMPTY_NFT_ID
        ? Utils.computeNftId(collectionOutputId)
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

    await setConsumedOutputIds(
      sourceAddress.bech32,
      Object.keys(outputsMap),
      [collectionOutputId],
      [],
    );
    let blockId = '';
    do {
      try {
        const nftOutputsToMint = nftOutputs.slice(0, nftsToMint);
        const { essence, unlocks } = await this.packNftMintBlock(
          sourceAddress,
          inputs,
          nftOutputsToMint,
          params,
        );
        blockId = await submitBlock(this.wallet, essence, unlocks);
        const batch = build5Db().batch();
        nftOutputsToMint.forEach((output, i) => {
          batch.update(build5Db().doc(`${COL.NFT}/${nfts[i].uid}`), {
            'mintingData.address': nftMintAddresses[i].bech32,
            'mintingData.storageDeposit': Number(output.amount),
          });
        });

        const transactionDocRef = build5Db().doc(`${COL.TRANSACTION}/${transaction.uid}`);
        batch.update(transactionDocRef, {
          'payload.amount': nftOutputsToMint.reduce((acc, act) => acc + Number(act.amount), 0),
          'payload.nfts': nfts.slice(0, nftsToMint).map((nft) => nft.uid),
        });

        await batch.commit();
        break;

        // eslint-disable-next-line no-empty
      } catch {}
      nftsToMint--;
    } while (nftsToMint > 0);

    if (!nftsToMint) {
      await unclockMnemonic(sourceAddress.bech32);
      console.error('nft mint error', 'Nft data to big to mint', head(nfts));
      throw Error('Nft data to big to mint');
    }
    return blockId;
  };

  public mintNtt = async (transaction: Transaction, params: WalletParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress!);
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

    const aliasAddress = Utils.aliasIdToBech32(
      aliasOutput.aliasId,
      this.wallet.info.protocol.bech32Hrp,
    );
    const collectionOutputs = await this.getNftOutputs(
      undefined,
      aliasAddress,
      sourceMnemonic.consumedNftOutputIds,
    );
    const [collectionOutputId, collectionOutput] = Object.entries(collectionOutputs)[0];
    const collectionNftId =
      collectionOutput.nftId === EMPTY_NFT_ID
        ? Utils.computeNftId(collectionOutputId)
        : collectionOutput.nftId;

    const awardDocRef = build5Db().doc(`${COL.AWARD}/${transaction.payload.award}`);
    const award = <Award>await awardDocRef.get();

    const issuerAddress = new NftAddress(collectionNftId);
    const ownerAddress = Utils.parseBech32Address(transaction.payload.targetAddress!);

    const metadata = await awardBadgeToNttMetadata(
      award,
      collectionNftId,
      transaction.uid,
      dayjs(get(transaction, 'payload.participatedOn')!.toDate()),
      get(transaction, 'payload.edition', 0),
    );
    const ntt = await createNftOutput(
      this.wallet,
      ownerAddress,
      issuerAddress,
      JSON.stringify(metadata),
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
    const { essence, unlocks } = await this.packNftMintBlock(sourceAddress, inputs, [ntt], params);
    return await submitBlock(this.wallet, essence, unlocks);
  };

  public mintMetadataNft = async (transaction: Transaction, params: WalletParams) => {
    const sourceIsGov =
      !transaction.payload.aliasGovAddress ||
      transaction.payload.aliasGovAddress === transaction.payload.sourceAddress;

    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress!);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const outputsMap = await this.wallet.getOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedOutputIds,
      false,
    );

    const aliasGovAddress = await this.wallet.getAddressDetails(
      transaction.payload.aliasGovAddress!,
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

    const collectionOutputId = await this.client.nftOutputId(transaction.payload.collectionId!);
    const collectionOutput = (await this.client.getOutput(collectionOutputId)).output as NftOutput;

    const inputs = [aliasOutputId, collectionOutputId, ...Object.keys(outputsMap)].map(
      UTXOInput.fromOutputId,
    );
    const inputsCommitment = Utils.computeInputsCommitment([
      aliasOutput,
      collectionOutput,
      ...Object.values(outputsMap),
    ]);
    const nextAliasOutput: AliasOutputBuilderParams = cloneDeep(aliasOutput);
    nextAliasOutput.stateIndex!++;
    const nextCollectionOutput: NftOutputBuilderParams = cloneDeep(collectionOutput);
    if (nextCollectionOutput.nftId === EMPTY_NFT_ID) {
      nextCollectionOutput.nftId = Utils.computeNftId(collectionOutputId);
    }

    const order = await build5Db()
      .doc(`${COL.TRANSACTION}/${transaction.payload.orderId}`)
      .get<Transaction>();
    const issuerAddress = new NftAddress(transaction.payload.collectionId!);
    const ownerAddress = Utils.parseBech32Address(transaction.payload.targetAddress!);
    const mutableMetadata = JSON.stringify(get(order, 'payload.metadata', {}));
    const nftOutput = await createNftOutput(
      this.wallet,
      ownerAddress,
      issuerAddress,
      '',
      undefined,
      mutableMetadata,
    );

    const remainder = mergeOutputs(Object.values(outputsMap));
    remainder.amount = (Number(remainder.amount) - Number(nftOutput.amount)).toString();

    const outputs: Output[] = [
      await this.client.buildAliasOutput(nextAliasOutput),
      await this.client.buildNftOutput(nextCollectionOutput),
      nftOutput,
    ];
    if (Number(remainder.amount)) {
      outputs.push(await this.client.buildBasicOutput(remainder));
    }

    const essence = await packEssence(this.wallet, inputs, inputsCommitment, outputs, params);
    const unlocks: Unlock[] = [
      await createUnlock(essence, aliasGovAddress),
      new AliasUnlock(0),
      sourceIsGov ? new ReferenceUnlock(0) : await createUnlock(essence, sourceAddress),
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
    return await submitBlock(this.wallet, essence, unlocks);
  };

  public mintStampNft = async (transaction: Transaction, params: WalletParams) => {
    const sourceIsGov =
      !transaction.payload.aliasGovAddress ||
      transaction.payload.aliasGovAddress === transaction.payload.sourceAddress;

    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress!);
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
    const nextAliasOutput: AliasOutputBuilderParams = cloneDeep(aliasOutput);
    if (nextAliasOutput.aliasId === EMPTY_ALIAS_ID) {
      nextAliasOutput.aliasId = Utils.computeAliasId(aliasOutputId);
    }
    nextAliasOutput.stateIndex!++;

    const stampDocRef = build5Db().doc(`${COL.STAMP}/${transaction.payload.stamp}`);
    const stamp = <Stamp>await stampDocRef.get();

    const issuerAddress = new AliasAddress(nextAliasOutput.aliasId);
    const collectionOutput = await createNftOutput(
      this.wallet,
      issuerAddress,
      issuerAddress,
      JSON.stringify(stampToNftMetadata(stamp)),
    );
    remainder.amount = (Number(remainder.amount) - Number(collectionOutput.amount)).toString();

    const inputs = [aliasOutputId, ...Object.keys(outputsMap)].map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment([
      aliasOutput,
      ...Object.values(outputsMap),
    ]);
    const outputs: Output[] = [
      await this.client.buildAliasOutput(nextAliasOutput),
      collectionOutput,
    ];
    if (Number(remainder.amount)) {
      outputs.push(await this.client.buildBasicOutput(remainder));
    }
    const essence = await packEssence(this.wallet, inputs, inputsCommitment, outputs, params);
    const unlocks: Unlock[] = [
      await createUnlock(essence, aliasGovAddress),
      sourceIsGov ? new ReferenceUnlock(0) : await createUnlock(essence, sourceAddress),
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
    return await submitBlock(this.wallet, essence, unlocks);
  };

  public updateMetadataNft = async (transaction: Transaction, params: WalletParams) => {
    const sourceIsGov =
      !transaction.payload.aliasGovAddress ||
      transaction.payload.aliasGovAddress === transaction.payload.sourceAddress;

    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress!);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const outputsMap = await this.wallet.getOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedOutputIds,
      false,
    );
    const [consumedOutputId, consumedOutput] = Object.entries(outputsMap)[0];

    const aliasGovAddress = await this.wallet.getAddressDetails(
      transaction.payload.aliasGovAddress!,
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

    const collectionOutputId = await this.client.nftOutputId(transaction.payload.collectionId!);
    const collectionOutput = (await this.client.getOutput(collectionOutputId)).output as NftOutput;

    const nft = <Nft>await build5Db().doc(`${COL.NFT}/${transaction.payload.nft}`).get();
    const nftOwnerAddressBech = nft.mintingData?.address || nft.depositData?.address!;
    const nftOwnerAddress = await this.wallet.getAddressDetails(nftOwnerAddressBech);
    const nftOutputId = await this.client.nftOutputId(nft.mintingData?.nftId!);
    const nftOutput = (await this.client.getOutput(nftOutputId)).output as NftOutput;

    const inputs = [aliasOutputId, collectionOutputId, nftOutputId, consumedOutputId].map(
      UTXOInput.fromOutputId,
    );
    const inputsCommitment = Utils.computeInputsCommitment([
      aliasOutput,
      collectionOutput,
      nftOutput,
      consumedOutput,
    ]);
    const nextAliasOutput: AliasOutputBuilderParams = cloneDeep(aliasOutput);
    nextAliasOutput.stateIndex!++;
    const nextCollectionOutput: NftOutputBuilderParams = cloneDeep(collectionOutput);
    if (nextCollectionOutput.nftId === EMPTY_NFT_ID) {
      nextCollectionOutput.nftId = Utils.computeNftId(collectionOutputId);
    }

    const order = await build5Db()
      .doc(`${COL.TRANSACTION}/${transaction.payload.orderId}`)
      .get<Transaction>();
    const mutableMetadata = JSON.stringify(get(order, 'payload.metadata', {}));
    const nextNftOutput: NftOutputBuilderParams = cloneDeep(nftOutput);
    if (nextNftOutput.nftId === EMPTY_NFT_ID) {
      nextNftOutput.nftId = Utils.computeNftId(nftOutputId);
    }
    nextNftOutput.features = [new MetadataFeature(utf8ToHex(mutableMetadata))];
    nextNftOutput.amount = Utils.computeStorageDeposit(
      await this.client.buildNftOutput(nextNftOutput),
      this.wallet.info.protocol.rentStructure,
    );

    const remainder: BasicOutputBuilderParams = cloneDeep(consumedOutput);
    remainder.amount = (
      Number(remainder.amount) +
      Number(nftOutput.amount) -
      Number(nextNftOutput.amount)
    ).toString();

    const outputs: Output[] = [
      await this.client.buildAliasOutput(nextAliasOutput),
      await this.client.buildNftOutput(nextCollectionOutput),
      await this.client.buildNftOutput(nextNftOutput),
    ];
    if (Number(remainder.amount)) {
      outputs.push(await this.client.buildBasicOutput(remainder));
    }

    const essence = await packEssence(this.wallet, inputs, inputsCommitment, outputs, params);
    const unlocks: Unlock[] = [
      await createUnlock(essence, aliasGovAddress),
      new AliasUnlock(0),
      aliasGovAddress.bech32 === nftOwnerAddressBech
        ? new ReferenceUnlock(0)
        : await createUnlock(essence, nftOwnerAddress),
      sourceIsGov ? new ReferenceUnlock(0) : await createUnlock(essence, sourceAddress),
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
    return await submitBlock(this.wallet, essence, unlocks);
  };

  public packNftMintBlock = async (
    address: AddressDetails,
    input: MintNftInputParams,
    nftOutputs: NftOutput[],
    params: WalletParams,
  ) => {
    const inputs = [input.aliasOutputId, input.collectionOutputId, ...input.consumedOutputIds].map(
      UTXOInput.fromOutputId,
    );
    const inputsCommitment = Utils.computeInputsCommitment([
      input.aliasOutput,
      input.collectionOutput,
      ...input.consumedOutputs,
    ]);
    const nextAliasOutput: AliasOutputBuilderParams = cloneDeep(input.aliasOutput);
    nextAliasOutput.stateIndex!++;
    const nextCollectionOutput: NftOutputBuilderParams = cloneDeep(input.collectionOutput);
    if (nextCollectionOutput.nftId === EMPTY_NFT_ID) {
      nextCollectionOutput.nftId = Utils.computeNftId(input.collectionOutputId);
    }

    const nftTotalStorageDeposit = nftOutputs.reduce((acc, act) => acc + Number(act.amount), 0);
    const remainderParams = mergeOutputs(input.consumedOutputs);
    remainderParams.amount = (Number(remainderParams.amount) - nftTotalStorageDeposit).toString();

    const outputs: Output[] = [
      await this.client.buildAliasOutput(nextAliasOutput),
      await this.client.buildNftOutput(nextCollectionOutput),
      ...nftOutputs,
    ];
    if (Number(remainderParams.amount)) {
      outputs.push(await this.client.buildBasicOutput(remainderParams));
    }
    const essence = await packEssence(this.wallet, inputs, inputsCommitment, outputs, params);
    const unlocks: Unlock[] = [
      await createUnlock(essence, address),
      new AliasUnlock(0),
      ...input.consumedOutputIds.map(() => new ReferenceUnlock(0)),
    ];
    return { essence, unlocks };
  };

  public packNft = async (
    nft: Nft,
    collection: Collection,
    royaltySpaceAddress: NetworkAddress,
    address: AddressDetails,
    collectionNftId: string,
  ) => {
    const issuerAddress = new NftAddress(collectionNftId);
    const ownerAddress = new Ed25519Address(address.hex);
    const metadata = JSON.stringify(
      await nftToMetadata(nft, collection, royaltySpaceAddress, collectionNftId),
    );
    return createNftOutput(this.wallet, ownerAddress, issuerAddress, metadata);
  };

  public changeNftOwner = async (transaction: Transaction, params: WalletParams) => {
    const sourceMnemonic = await MnemonicService.getData(transaction.payload.sourceAddress);
    const nftOutputs = await this.getNftOutputs(
      transaction.payload.nftId || undefined,
      transaction.payload.sourceAddress,
      sourceMnemonic.consumedNftOutputIds,
    );

    const nftOutput = Object.values(nftOutputs)[0];

    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress!);
    const targetAddress = Utils.parseBech32Address(transaction.payload.targetAddress!);
    const output: NftOutputBuilderParams = cloneDeep(nftOutput);
    output.features = output.features?.filter((f) => f.type !== FeatureType.Tag);
    output.unlockConditions = [new AddressUnlockCondition(targetAddress)];

    const vestingAt = dayjs(transaction.payload.vestingAt?.toDate());
    if (vestingAt.isAfter(dayjs())) {
      output.unlockConditions.push(new TimelockUnlockCondition(vestingAt.unix()));
    }

    if (output.nftId === EMPTY_NFT_ID) {
      output.nftId = Utils.computeNftId(Object.keys(nftOutputs)[0]);
    }

    const inputs = Object.keys(nftOutputs).map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment(Object.values(nftOutputs));
    const essence = await packEssence(
      this.wallet,
      inputs,
      inputsCommitment,
      [await this.client.buildNftOutput(output)],
      params,
    );

    await setConsumedOutputIds(sourceAddress.bech32, [], Object.keys(nftOutputs));
    return await submitBlock(this.wallet, essence, [await createUnlock(essence, sourceAddress)]);
  };

  public lockCollection = async (transaction: Transaction, params: WalletParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress!);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const aliasWallet = new AliasWallet(this.wallet);
    const aliasOutputs = await aliasWallet.getAliasOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedAliasOutputIds,
    );
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0];

    const nextAliasOutput: AliasOutputBuilderParams = cloneDeep(aliasOutput);
    nextAliasOutput.stateIndex!++;

    const aliasAddress = Utils.aliasIdToBech32(
      aliasOutput.aliasId,
      this.wallet.info.protocol.bech32Hrp,
    );
    const collectionOutputs = await this.getNftOutputs(
      undefined,
      aliasAddress,
      sourceMnemonic.consumedNftOutputIds,
    );
    const [collectionOutputId, collectionOutput] = Object.entries(collectionOutputs)[0];
    const nextCollectionOutput: NftOutputBuilderParams = cloneDeep(collectionOutput);
    nextCollectionOutput.unlockConditions = [new AddressUnlockCondition(ZERO_ADDRESS)];

    const inputs = [aliasOutputId, collectionOutputId].map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment([aliasOutput, collectionOutput]);
    const outputs = [
      await this.client.buildAliasOutput(nextAliasOutput),
      await this.client.buildNftOutput(nextCollectionOutput),
    ];
    const essence = await packEssence(this.wallet, inputs, inputsCommitment, outputs, params);
    const unlocks: Unlock[] = [await createUnlock(essence, sourceAddress), new AliasUnlock(0)];

    await setConsumedOutputIds(sourceAddress.bech32, [], [collectionOutputId], [aliasOutputId]);
    return await submitBlock(this.wallet, essence, unlocks);
  };

  public getNftOutputs = async (
    nftId: string | undefined,
    sourceAddress: NetworkAddress | undefined,
    prevConsumedNftOutputId: string[] = [],
  ) => {
    const outputIds = await this.getNftOutputIds(nftId, sourceAddress, prevConsumedNftOutputId);
    const outputs = await this.client.getOutputs(outputIds);

    return outputs.reduce(
      (acc, act, i) => ({ ...acc, [outputIds[i]]: act.output as NftOutput }),
      {} as { [key: string]: NftOutput },
    );
  };

  public getById = async (nftId: string) => {
    const nftOutputId = await this.client.nftOutputId(nftId);
    const outputResponse = await this.wallet.client.getOutput(nftOutputId);
    return outputResponse.output as NftOutput;
  };

  private getNftOutputIds = async (
    nftId: string | undefined,
    sourceAddress: NetworkAddress | undefined,
    prevConsumedNftOutputId: string[] = [],
  ) => {
    if (!isEmpty(prevConsumedNftOutputId)) {
      return prevConsumedNftOutputId;
    }
    if (nftId) {
      return [await this.client.nftOutputId(nftId)];
    }
    const items = (await this.client.nftOutputIds([{ address: sourceAddress! }])).items;
    return isEmpty(items) ? [] : [items[0]];
  };
}

const getNftMintingAddress = (nfts: Nft[], wallet: Wallet) => {
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
