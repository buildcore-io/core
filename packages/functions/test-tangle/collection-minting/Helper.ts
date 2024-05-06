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
  Network,
  Nft,
  NftAccess,
  NftStatus,
  Space,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  UnsoldMintingOptions,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { FeatureType, MetadataFeature, NftOutput, hexToUtf8 } from '@iota/sdk';
import dayjs from 'dayjs';
import { set } from 'lodash';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { Wallet } from '../../src/services/wallet/wallet';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { submitMilestoneFunc, wait } from '../../test/controls/common';
import { MEDIA, getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

export class CollectionMintHelper {
  public network = Network.RMS;
  public collection = '';
  public guardian = '';
  public space: Space = {} as any;
  public royaltySpace: Space = {} as any;
  public member = '';
  public walletService: Wallet = {} as any;
  public nftWallet: NftWallet = {} as any;

  public beforeAll = async () => {
    this.walletService = await getWallet(this.network);
    this.nftWallet = new NftWallet(this.walletService);
  };

  public beforeEach = async () => {
    this.guardian = await testEnv.createMember();
    this.member = await testEnv.createMember();
    this.space = await testEnv.createSpace(this.guardian);
    this.royaltySpace = await testEnv.createSpace(this.guardian);

    mockWalletReturnValue(
      this.guardian,
      this.createDummyCollection(this.space.uid, this.royaltySpace.uid),
    );
    this.collection = (await testEnv.wrap<Collection>(WEN_FUNC.createCollection)).uid;
  };

  public createLockedNft = async () => {
    let nft: any = this.createDummyNft(this.collection!);
    delete nft.uid;
    delete nft.status;
    delete nft.placeholderNft;
    mockWalletReturnValue(this.guardian!, nft);
    nft = <Nft>await testEnv.wrap<Nft>(WEN_FUNC.createNft);

    await database()
      .doc(COL.NFT, nft.uid)
      .update({ availableFrom: dayjs().subtract(1, 'h').toDate() });

    mockWalletReturnValue(this.guardian!, {
      collection: this.collection,
      nft: nft.uid,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.orderNft);
    return <Nft>await database().doc(COL.NFT, nft.uid).get();
  };

  public createAndOrderNft = async (buyAndAuctionId = false, shouldBid = false) => {
    let nft: any = this.createDummyNft(this.collection!);
    delete nft.uid;
    delete nft.status;
    delete nft.placeholderNft;
    mockWalletReturnValue(this.guardian!, nft);
    nft = await testEnv.wrap<Nft>(WEN_FUNC.createNft);

    if (buyAndAuctionId) {
      await database()
        .doc(COL.NFT, nft.uid)
        .update({ availableFrom: dayjs().subtract(1, 'h').toDate() });

      mockWalletReturnValue(this.guardian!, {
        collection: this.collection,
        nft: nft.uid,
      });
      const order = await testEnv.wrap<Transaction>(WEN_FUNC.orderNft);
      await submitMilestoneFunc(order);

      mockWalletReturnValue(this.guardian!, this.dummyAuctionData(nft.uid));
      await testEnv.wrap(WEN_FUNC.setForSaleNft);
      await wait(async () => (await database().doc(COL.NFT, nft.uid).get())?.available === 3);

      if (shouldBid) {
        mockWalletReturnValue(this.member!, { nft: nft.uid });
        const bidOrder = await testEnv.wrap<Transaction>(WEN_FUNC.openBid);
        await submitMilestoneFunc(bidOrder, 2 * MIN_IOTA_AMOUNT);
      }
    }
    return <Nft>await database().doc(COL.NFT, nft.uid).get();
  };

  public mintCollection = async (
    unsoldMintingOptions = UnsoldMintingOptions.KEEP_PRICE,
    price = 0,
  ) => {
    const request = {
      collection: this.collection,
      network: this.network,
      unsoldMintingOptions,
    };
    if (unsoldMintingOptions === UnsoldMintingOptions.SET_NEW_PRICE) {
      set(request, 'price', price);
    }
    mockWalletReturnValue(this.guardian!, request);
    const collectionMintOrder = await testEnv.wrap<Transaction>(WEN_FUNC.mintCollection);
    await requestFundsFromFaucet(
      this.network!,
      collectionMintOrder.payload.targetAddress,
      collectionMintOrder.payload.amount,
    );
    const collectionDocRef = database().doc(COL.COLLECTION, this.collection);
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

  public lockCollectionConfirmed = async () => {
    const lockTran = (
      await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.MINT_COLLECTION)
        .where('payload_type', '==', TransactionPayloadType.LOCK_COLLECTION)
        .where('member', '==', this.guardian)
        .get()
    ).map((d) => <Transaction>d);

    expect(lockTran.length).toBe(1);
    expect(lockTran[0].payload?.walletReference?.confirmed).toBe(true);
  };

  public createDummyCollection = (space: string, royaltiesSpace = '') => ({
    name: 'Collection A',
    description: 'babba',
    type: CollectionType.CLASSIC,
    royaltiesFee: royaltiesSpace ? 0.6 : 0,
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
    name: 'NFT ' + Math.random(),
    description,
    collection,
    availableFrom: dayjs().add(1, 'hour').toDate(),
    price: 10 * 1000 * 1000,
    uid: getRandomEthAddress(),
    status: NftStatus.PRE_MINTED,
    placeholderNft: false,
    media: MEDIA,
    properties: {
      custom: {
        label: 'custom',
        value: 'custom',
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

  public getRandomDescrptiron = (length = 500) =>
    Array.from(Array(length))
      .map(() => Math.random().toString().slice(2, 3))
      .join('');
}

export const getNftMetadata = (nft: NftOutput | undefined) => {
  try {
    const hexMetadata = <MetadataFeature | undefined>(
      nft?.immutableFeatures?.find((f) => f.type === FeatureType.Metadata)
    );
    if (!hexMetadata?.data) {
      return {};
    }
    return JSON.parse(hexToUtf8(hexMetadata.data) || '{}');
  } catch {
    return {};
  }
};
