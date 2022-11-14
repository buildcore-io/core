/* eslint-disable @typescript-eslint/no-explicit-any */
import { IMetadataFeature, INftOutput, METADATA_FEATURE_TYPE } from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import {
  Access,
  Categories,
  COL,
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
  TransactionMintCollectionType,
  TransactionType,
  UnsoldMintingOptions,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { approveCollection, createCollection } from '../../src/controls/collection.control';
import { mintCollectionOrder } from '../../src/controls/nft/collection-mint.control';
import { createNft, setForSaleNft } from '../../src/controls/nft/nft.control';
import { openBid, orderNft } from '../../src/controls/order.control';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import {
  createMember as createMemberTest,
  createSpace,
  milestoneProcessed,
  mockWalletReturnValue,
  submitMilestoneFunc,
  wait,
} from '../../test/controls/common';
import { getWallet, MEDIA, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

export class CollectionMintHelper {
  public walletSpy: any | undefined;
  public network: Network = Network.RMS;
  public collection: string | undefined;
  public guardian: string | undefined;
  public space: Space | undefined;
  public royaltySpace: Space | undefined;
  public member: string | undefined;
  public walletService: SmrWallet | undefined;
  public nftWallet: NftWallet | undefined;

  public beforeAll = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.walletService = (await getWallet(this.network)) as SmrWallet;
    this.nftWallet = new NftWallet(this.walletService);
  };

  public beforeEach = async () => {
    this.guardian = await createMemberTest(this.walletSpy);
    this.member = await createMemberTest(this.walletSpy);
    this.space = await createSpace(this.walletSpy, this.guardian);
    this.royaltySpace = await createSpace(this.walletSpy, this.guardian);

    mockWalletReturnValue(
      this.walletSpy,
      this.guardian,
      this.createDummyCollection(this.space.uid, this.royaltySpace.uid),
    );
    this.collection = (await testEnv.wrap(createCollection)({})).uid;

    mockWalletReturnValue(this.walletSpy, this.guardian, { uid: this.collection });
    await testEnv.wrap(approveCollection)({});
  };

  public createLockedNft = async () => {
    let nft: any = this.createDummyNft(this.collection!);
    delete nft.uid;
    delete nft.status;
    delete nft.placeholderNft;
    mockWalletReturnValue(this.walletSpy, this.guardian!, nft);
    nft = <Nft>await testEnv.wrap(createNft)({});

    await admin
      .firestore()
      .doc(`${COL.NFT}/${nft.uid}`)
      .update({ availableFrom: dayjs().subtract(1, 'h').toDate() });

    mockWalletReturnValue(this.walletSpy, this.guardian!, {
      collection: this.collection,
      nft: nft.uid,
    });
    await testEnv.wrap(orderNft)({});
    return <Nft>(await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).get()).data();
  };

  public createAndOrderNft = async (buyAndAuctionId = false, shouldBid = false) => {
    let nft: any = this.createDummyNft(this.collection!);
    delete nft.uid;
    delete nft.status;
    delete nft.placeholderNft;
    mockWalletReturnValue(this.walletSpy, this.guardian!, nft);
    nft = await testEnv.wrap(createNft)({});

    if (buyAndAuctionId) {
      await admin
        .firestore()
        .doc(`${COL.NFT}/${nft.uid}`)
        .update({ availableFrom: dayjs().subtract(1, 'h').toDate() });

      mockWalletReturnValue(this.walletSpy, this.guardian!, {
        collection: this.collection,
        nft: nft.uid,
      });
      const order = await testEnv.wrap(orderNft)({});
      const milestone = await submitMilestoneFunc(
        order.payload.targetAddress,
        order.payload.amount,
      );
      await milestoneProcessed(milestone.milestone, milestone.tranId);

      mockWalletReturnValue(this.walletSpy, this.guardian!, this.dummyAuctionData(nft.uid));
      await testEnv.wrap(setForSaleNft)({});
      await wait(
        async () =>
          (await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).get()).data()?.available === 3,
      );

      if (shouldBid) {
        mockWalletReturnValue(this.walletSpy, this.member!, { nft: nft.uid });
        const bidOrder = await testEnv.wrap(openBid)({});
        const bidMilestone = await submitMilestoneFunc(
          bidOrder.payload.targetAddress,
          2 * MIN_IOTA_AMOUNT,
        );
        await milestoneProcessed(bidMilestone.milestone, bidMilestone.tranId);
      }
    }
    return <Nft>(await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).get()).data();
  };

  public mintCollection = async (
    unsoldMintingOptions = UnsoldMintingOptions.KEEP_PRICE,
    price = 0,
  ) => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, {
      collection: this.collection,
      network: this.network,
      unsoldMintingOptions,
      price,
    });
    const collectionMintOrder = await testEnv.wrap(mintCollectionOrder)({});
    await requestFundsFromFaucet(
      this.network!,
      collectionMintOrder.payload.targetAddress,
      collectionMintOrder.payload.amount,
    );
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${this.collection}`);
    await wait(async () => {
      const data = <Collection>(await collectionDocRef.get()).data();
      return data.status === CollectionStatus.MINTED;
    });

    const collectionData = <Collection>(await collectionDocRef.get()).data();
    expect(collectionData.mintingData?.network).toBe(this.network);
    expect(collectionData.mintingData?.mintedBy).toBe(this.guardian);
    expect(collectionData.mintingData?.mintingOrderId).toBe(collectionMintOrder.uid);
    expect(collectionData.mintingData?.address).toBe(collectionMintOrder.payload.targetAddress);
    expect(collectionData.mintingData?.nftsToMint).toBe(0);

    const ownerChangeTran = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.MINT_COLLECTION)
        .where('payload.type', '==', TransactionMintCollectionType.SENT_ALIAS_TO_GUARDIAN)
        .where('member', '==', this.guardian)
        .get()
    ).docs.map((d) => <Transaction>d.data());

    expect(ownerChangeTran.length).toBe(1);
    expect(ownerChangeTran[0].payload?.walletReference?.confirmed).toBe(true);
  };

  public lockCollectionConfirmed = async () => {
    const lockTran = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.MINT_COLLECTION)
        .where('payload.type', '==', TransactionMintCollectionType.LOCK_COLLECTION)
        .where('member', '==', this.guardian)
        .get()
    ).docs.map((d) => <Transaction>d.data());

    expect(lockTran.length).toBe(1);
    expect(lockTran[0].payload?.walletReference?.confirmed).toBe(true);
  };

  public createDummyCollection = (space: string, royaltiesSpace: string) => ({
    name: 'Collection A',
    description: 'babba',
    type: CollectionType.CLASSIC,
    royaltiesFee: 0.6,
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
    uid: getRandomEthAddress(),
    status: NftStatus.PRE_MINTED,
    placeholderNft: false,
    media: MEDIA,
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

export const getNftMetadata = (nft: INftOutput | undefined) => {
  try {
    const hexMetadata = <IMetadataFeature | undefined>(
      nft?.immutableFeatures?.find((f) => f.type === METADATA_FEATURE_TYPE)
    );
    if (!hexMetadata?.data) {
      return {};
    }
    return JSON.parse(Converter.hexToUtf8(hexMetadata.data) || '{}');
  } catch {
    return {};
  }
};
