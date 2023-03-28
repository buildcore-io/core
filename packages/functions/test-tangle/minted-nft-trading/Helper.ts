/* eslint-disable @typescript-eslint/no-explicit-any */
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
  Timestamp,
  UnsoldMintingOptions,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../src/firebase/firestore/soondb';
import {
  approveCollection,
  createCollection,
  mintCollection,
} from '../../src/runtime/firebase/collection/index';
import { createNft, orderNft, setForSaleNft } from '../../src/runtime/firebase/nft/index';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import * as wallet from '../../src/utils/wallet.utils';
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

export class Helper {
  public walletSpy: any | undefined;
  public network = Network.RMS;
  public collection: string | undefined;
  public guardian: string | undefined;
  public space: Space | undefined;
  public royaltySpace: Space | undefined;
  public member: string | undefined;
  public walletService: SmrWallet | undefined;
  public nftWallet: NftWallet | undefined;
  public nft: Nft | undefined;

  public beforeAll = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.walletService = (await getWallet(this.network)) as SmrWallet;
    this.nftWallet = new NftWallet(this.walletService);
  };

  public beforeEach = async (collectionType = CollectionType.CLASSIC) => {
    this.guardian = await createMemberTest(this.walletSpy);
    this.member = await createMemberTest(this.walletSpy);
    this.space = await createSpace(this.walletSpy, this.guardian);
    this.royaltySpace = await createSpace(this.walletSpy, this.guardian);

    mockWalletReturnValue(
      this.walletSpy,
      this.guardian,
      this.createDummyCollection(this.space.uid, this.royaltySpace.uid, collectionType),
    );
    this.collection = (await testEnv.wrap(createCollection)({})).uid;

    mockWalletReturnValue(this.walletSpy, this.guardian, { uid: this.collection });
    await testEnv.wrap(approveCollection)({});
  };

  public mintCollection = async (expiresAt?: Timestamp) => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, {
      collection: this.collection,
      network: this.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    const collectionMintOrder = await testEnv.wrap(mintCollection)({});
    await requestFundsFromFaucet(
      this.network!,
      collectionMintOrder.payload.targetAddress,
      collectionMintOrder.payload.amount,
      expiresAt,
    );
    const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${this.collection}`);
    await wait(async () => {
      const data = <Collection>await collectionDocRef.get();
      return data.status === CollectionStatus.MINTED;
    });

    const nftDocRef = soonDb().doc(`${COL.NFT}/${this.nft?.uid}`);
    this.nft = <Nft>await nftDocRef.get();
  };

  public createAndOrderNft = async (shouldOrder = true) => {
    let nft: any = this.createDummyNft(this.collection!);
    delete nft.uid;
    delete nft.status;
    delete nft.placeholderNft;
    mockWalletReturnValue(this.walletSpy, this.guardian!, nft);
    nft = await testEnv.wrap(createNft)({});

    await soonDb()
      .doc(`${COL.NFT}/${nft.uid}`)
      .update({ availableFrom: dayjs().subtract(1, 'h').toDate() });
    if (shouldOrder) {
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
    }

    this.nft = <Nft>await soonDb().doc(`${COL.NFT}/${nft.uid}`).get();
    return this.nft;
  };

  public setAvailableForAuction = async () => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, this.dummyAuctionData(this.nft!.uid));
    await testEnv.wrap(setForSaleNft)({});
    await wait(
      async () => (await soonDb().doc(`${COL.NFT}/${this.nft!.uid}`).get<Nft>())?.available === 3,
    );
  };

  public setAvailableForSale = async () => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, this.dummySaleData(this.nft!.uid));
    await testEnv.wrap(setForSaleNft)({});
    await wait(
      async () => (await soonDb().doc(`${COL.NFT}/${this.nft!.uid}`).get<Nft>())?.available === 1,
    );
  };

  public createDummyCollection = (space: string, royaltiesSpace: string, type: CollectionType) => ({
    name: 'Collection A',
    description: 'babba',
    type,
    royaltiesFee: 0.6,
    category: Categories.ART,
    access: Access.OPEN,
    space,
    royaltiesSpace,
    onePerMemberOnly: false,
    availableFrom: dayjs().add(1, 'hour').toDate(),
    price: MIN_IOTA_AMOUNT,
    bannerUrl: MEDIA,
  });

  public createDummyNft = (collection: string, description = 'babba') => ({
    name: 'NFT ' + description,
    description,
    collection,
    availableFrom: dayjs().add(1, 'hour').toDate(),
    price: MIN_IOTA_AMOUNT,
    uid: wallet.getRandomEthAddress(),
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

  public dummySaleData = (uid: string) => ({
    nft: uid,
    price: MIN_IOTA_AMOUNT,
    availableFrom: dayjs().toDate(),
    access: NftAccess.OPEN,
  });
}
