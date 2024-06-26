/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import {
  Access,
  COL,
  Categories,
  Collection,
  CollectionStatus,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Member,
  Network,
  Nft,
  NftAccess,
  Space,
  Timestamp,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  UnsoldMintingOptions,
  WEN_FUNC,
} from '@buildcore/interfaces';
import {
  AddressUnlockCondition,
  ExpirationUnlockCondition,
  NftOutputBuilderParams,
  ReferenceUnlock,
  StorageDepositReturnUnlockCondition,
  TagFeature,
  UTXOInput,
  Utils,
  utf8ToHex,
} from '@iota/sdk';
import dayjs from 'dayjs';
import { cloneDeep } from 'lodash';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { mergeOutputs, packBasicOutput } from '../../src/utils/basic-output.utils';
import { createUnlock, packEssence, submitBlock } from '../../src/utils/block.utils';
import { EMPTY_NFT_ID } from '../../src/utils/collection-minting-utils/nft.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { submitMilestoneFunc, wait } from '../../test/controls/common';
import { MEDIA, getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

export class Helper {
  public network = Network.RMS;
  public collection: string | undefined;
  public guardian: string | undefined;
  public space: Space | undefined;
  public walletService: Wallet | undefined;
  public nft: Nft | undefined;
  public guardianAddress: AddressDetails | undefined;
  public royaltySpace: Space | undefined;

  public beforeAll = async () => {
    this.walletService = await getWallet(this.network);
  };

  public beforeEach = async () => {
    this.guardian = await testEnv.createMember();
    this.space = await testEnv.createSpace(this.guardian!);
    this.royaltySpace = await testEnv.createSpace(this.guardian!);

    mockWalletReturnValue(
      this.guardian!,
      this.createDummyCollection(this.space!.uid, this.royaltySpace!.uid),
    );
    this.collection = (await testEnv.wrap<Collection>(WEN_FUNC.createCollection)).uid;

    await database().doc(COL.COLLECTION, this.collection).update({ approved: true });

    const guardianDocRef = database().doc(COL.MEMBER, this.guardian);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, this.network!);
    this.guardianAddress = await this.walletService?.getAddressDetails(guardianBech32)!;
  };

  public createAndOrderNft = async () => {
    let nft: any = this.createDummyNft(this.collection!);
    delete nft.uid;
    mockWalletReturnValue(this.guardian!, nft);
    nft = await testEnv.wrap<Nft>(WEN_FUNC.createNft);

    await database()
      .doc(COL.NFT, nft.uid)
      .update({ availableFrom: dayjs().subtract(1, 'h').toDate() });

    mockWalletReturnValue(this.guardian!, {
      collection: this.collection,
      nft: nft.uid,
    });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.orderNft);
    await submitMilestoneFunc(order);

    this.nft = <Nft>await database().doc(COL.NFT, nft.uid).get();
    return this.nft;
  };

  public mintCollection = async (expiresAt?: Timestamp) => {
    mockWalletReturnValue(this.guardian!, {
      collection: this.collection!,
      network: this.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    const collectionMintOrder = await testEnv.wrap<Transaction>(WEN_FUNC.mintCollection);
    await requestFundsFromFaucet(
      this.network,
      this.guardianAddress!.bech32,
      10 * MIN_IOTA_AMOUNT,
      expiresAt,
    );
    await this.walletService!.send(
      this.guardianAddress!,
      collectionMintOrder.payload.targetAddress!,
      collectionMintOrder.payload.amount!,
      {},
    );
    await MnemonicService.store(this.guardianAddress!.bech32, this.guardianAddress!.mnemonic);

    const collectionDocRef = database().doc(COL.COLLECTION, this.collection!);
    await wait(async () => {
      const data = <Collection>await collectionDocRef.get();
      return data.status === CollectionStatus.MINTED;
    });

    const collectionData = <Collection>await collectionDocRef.get();
    expect(collectionData.mintingData?.network).toBe(this.network);
    expect(collectionData.mintingData?.mintedBy).toBe(this.guardian);
    expect(collectionData.mintingData?.mintingOrderId).toBe(collectionMintOrder.uid);
    expect(collectionData.mintingData?.address).toBe(collectionMintOrder.payload.targetAddress);
    expect(collectionData.mintingData?.nftsToMint).toBe(0);

    const ownerChangeTran = (
      await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.MINT_COLLECTION)
        .where('payload_type', '==', TransactionPayloadType.SEND_ALIAS_TO_GUARDIAN)
        .where('member', '==', this.guardian)
        .get()
    ).map((d) => <Transaction>d);

    expect(ownerChangeTran.length).toBe(1);
    expect(ownerChangeTran[0].payload?.walletReference?.confirmed).toBe(true);
  };

  public sendNftToAddress = async (
    sourceAddress: AddressDetails,
    targetAddressBech32: string,
    expiresOn?: Timestamp,
    nftId?: string,
    extraAmount = 0,
    tag = '',
    storageDeposit = false,
  ) => {
    await requestFundsFromFaucet(
      this.network,
      sourceAddress.bech32,
      Math.max(extraAmount, MIN_IOTA_AMOUNT),
    );

    const nftWallet = new NftWallet(this.walletService!);
    const outputs = await this.walletService!.getOutputs(sourceAddress.bech32, [], false);
    const total = Number(mergeOutputs(Object.values(outputs)).amount);

    const [nftOutputId, consumedNftOutput] = Object.entries(
      await nftWallet.getNftOutputs(nftId, sourceAddress.bech32),
    )[0];

    const nftOutputParams: NftOutputBuilderParams = cloneDeep(consumedNftOutput);
    const targetAddress = Utils.parseBech32Address(targetAddressBech32);
    nftOutputParams.unlockConditions = [new AddressUnlockCondition(targetAddress)];
    if (tag) {
      nftOutputParams.features = nftOutputParams.features || [];
      nftOutputParams.features.push(new TagFeature(utf8ToHex(tag)));
    }
    if (expiresOn) {
      nftOutputParams.unlockConditions.push(
        new ExpirationUnlockCondition(
          Utils.parseBech32Address(sourceAddress.bech32),
          dayjs(expiresOn.toDate()).unix(),
        ),
      );
    }
    if (storageDeposit) {
      nftOutputParams.unlockConditions.push(
        new StorageDepositReturnUnlockCondition(
          Utils.parseBech32Address(sourceAddress.bech32),
          BigInt(nftOutputParams.amount!),
        ),
      );
    }
    const consumedExtraAmount = extraAmount || expiresOn ? extraAmount || MIN_IOTA_AMOUNT : 0;
    nftOutputParams.amount = (Number(nftOutputParams.amount) + consumedExtraAmount).toString();
    if (nftOutputParams.nftId === EMPTY_NFT_ID) {
      nftOutputParams.nftId = Utils.computeNftId(nftOutputId);
    }

    const remainderAmount = total - consumedExtraAmount;
    const remainder = await packBasicOutput(
      this.walletService!,
      sourceAddress.bech32,
      remainderAmount,
      {},
    );

    const inputs = [...Object.keys(outputs), nftOutputId].map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment([
      ...Object.values(outputs),
      consumedNftOutput,
    ]);
    const nftOutput = await this.walletService!.client.buildNftOutput(nftOutputParams);
    const essence = await packEssence(
      this.walletService!,
      inputs,
      inputsCommitment,
      remainderAmount ? [nftOutput, remainder] : [nftOutput],
      {},
    );
    const refUnlocks = Object.keys(outputs).map(() => new ReferenceUnlock(0));
    const blockId = await submitBlock(this.walletService!, essence, [
      await createUnlock(essence, sourceAddress),
      ...refUnlocks,
    ]);
    await testEnv.createBlock(blockId);
    return blockId;
  };

  public withdrawNftAndAwait = async (nft: string) => {
    mockWalletReturnValue(this.guardian!, { nft });
    await testEnv.wrap(WEN_FUNC.withdrawNft);
    await wait(async () => {
      const snap = await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.WITHDRAW_NFT)
        .where('payload_nft', '==', nft)
        .get();
      return snap[0]?.payload?.walletReference?.confirmed;
    });
  };

  public setAvailableForAuction = async () => {
    mockWalletReturnValue(this.guardian!, this.dummyAuctionData(this.nft!.uid));
    await testEnv.wrap(WEN_FUNC.setForSaleNft);
    await wait(async () => (await database().doc(COL.NFT, this.nft!.uid).get())?.available === 3);
  };

  public setAvailableForSale = async () => {
    mockWalletReturnValue(this.guardian!, this.dummySaleData(this.nft!.uid));
    await testEnv.wrap(WEN_FUNC.setForSaleNft);
    await wait(async () => (await database().doc(COL.NFT, this.nft!.uid).get())?.available === 1);
  };

  public createDummyCollection = (space: string, royaltiesSpace: string) => ({
    name: 'Collection A',
    description: 'babba',
    type: CollectionType.CLASSIC,
    royaltiesFee: 0.45,
    category: Categories.ART,
    access: Access.OPEN,
    space,
    royaltiesSpace,
    onePerMemberOnly: false,
    availableFrom: dayjs().add(1, 'hour').toDate(),
    price: 10 * 1000 * 1000,
    bannerUrl: MEDIA,
  });

  public createDummyNft = (collection: string, description = 'babba') => ({
    name: 'NFT ' + description,
    description,
    collection,
    availableFrom: dayjs().add(1, 'hour').toDate(),
    price: 10 * 1000 * 1000,
    uid: wallet.getRandomEthAddress(),
    media: MEDIA,
    properties: {
      custom: {
        label: 'custom',
        value: 1,
      },
    },
    stats: {
      customStat: {
        label: 'customStat',
        value: 'customStat',
      },
    },
  });

  public dummyAuctionData = (uid: string) => ({
    nft: uid,
    price: MIN_IOTA_AMOUNT,
    availableFrom: dayjs().toDate(),
    auctionFrom: dayjs().toDate(),
    auctionFloorPrice: MIN_IOTA_AMOUNT,
    auctionLength: 60000 * 4,
    access: NftAccess.OPEN,
  });

  public dummySaleData = (uid: string) => ({
    nft: uid,
    price: MIN_IOTA_AMOUNT,
    availableFrom: dayjs().toDate(),
    access: NftAccess.OPEN,
  });
}
