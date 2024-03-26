/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
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
  SOON_PROJECT_ID,
  Space,
  Timestamp,
  Transaction,
  TransactionType,
  UnsoldMintingOptions,
  WEN_FUNC,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { submitMilestoneFunc, wait } from '../../test/controls/common';
import { MEDIA, getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';

export class Helper {
  public network = Network.RMS;
  public collection = '';
  public guardian = '';
  public space: Space = {} as any;
  public royaltySpace: Space = {} as any;
  public member = '';
  public walletService: Wallet = {} as any;
  public nftWallet: NftWallet = {} as any;
  public nft: Nft = {} as any;
  public tangleOrder: Transaction = {} as any;

  public beforeEach = async (network: Network, collectionType = CollectionType.CLASSIC) => {
    this.network = network;
    this.walletService = await getWallet(this.network);
    this.nftWallet = new NftWallet(this.walletService);

    this.tangleOrder = await getTangleOrder(network);

    this.guardian = await testEnv.createMember();
    this.member = await testEnv.createMember();
    this.space = await testEnv.createSpace(this.guardian);
    this.royaltySpace = await testEnv.createSpace(this.guardian);

    mockWalletReturnValue(
      this.guardian,
      this.createDummyCollection(this.space.uid, this.royaltySpace.uid, collectionType),
    );
    this.collection = (await testEnv.wrap<Collection>(WEN_FUNC.createCollection)).uid;

    await build5Db().doc(COL.COLLECTION, this.collection).update({ approved: true });
  };

  public mintCollection = async (expiresAt?: Timestamp) => {
    mockWalletReturnValue(this.guardian!, {
      collection: this.collection,
      network: this.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    const collectionMintOrder = await testEnv.wrap<Transaction>(WEN_FUNC.mintCollection);
    await requestFundsFromFaucet(
      this.network!,
      collectionMintOrder.payload.targetAddress,
      collectionMintOrder.payload.amount,
      expiresAt,
    );
    const collectionDocRef = build5Db().doc(COL.COLLECTION, this.collection);
    await wait(async () => {
      const data = <Collection>await collectionDocRef.get();
      return data.status === CollectionStatus.MINTED;
    });

    const nftDocRef = build5Db().doc(COL.NFT, this.nft?.uid);
    this.nft = <Nft>await nftDocRef.get();
  };

  public createAndOrderNft = async (shouldOrder = true) => {
    let nft: any = this.createDummyNft(this.collection!);
    delete nft.uid;
    delete nft.status;
    delete nft.placeholderNft;
    mockWalletReturnValue(this.guardian!, nft);
    nft = await testEnv.wrap<Nft>(WEN_FUNC.createNft);

    await build5Db()
      .doc(COL.NFT, nft.uid)
      .update({ availableFrom: dayjs().subtract(1, 'h').toDate() });
    if (shouldOrder) {
      mockWalletReturnValue(this.guardian!, {
        collection: this.collection,
        nft: nft.uid,
      });
      const order = await testEnv.wrap<Transaction>(WEN_FUNC.orderNft);
      await submitMilestoneFunc(order);
    }

    this.nft = <Nft>await build5Db().doc(COL.NFT, nft.uid).get();
    return this.nft;
  };

  public setAvailableForAuction = async (nft?: string) => {
    const uid = nft || this.nft?.uid!;
    mockWalletReturnValue(this.guardian!, this.dummyAuctionData(uid));
    await testEnv.wrap(WEN_FUNC.setForSaleNft);
    await wait(async () => (await build5Db().doc(COL.NFT, uid).get())?.available === 3);
  };

  public setAvailableForSale = async (nftId?: string) => {
    const uid = nftId || this.nft!.uid;
    mockWalletReturnValue(this.guardian!, this.dummySaleData(uid));
    await testEnv.wrap(WEN_FUNC.setForSaleNft);
    await wait(async () => (await build5Db().doc(COL.NFT, uid).get())?.available === 1);
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

  public sendNftToAddress = async (
    sourceAddress: AddressDetails,
    targetAddressBech32: string,
    nftId: string,
  ) => {
    const order: Transaction = {
      project: SOON_PROJECT_ID,
      type: TransactionType.WITHDRAW_NFT,
      uid: wallet.getRandomEthAddress(),
      member: this.guardian,
      createdOn: serverTime(),
      network: this.network,
      payload: {
        sourceAddress: sourceAddress.bech32,
        targetAddress: targetAddressBech32,
        nftId,
      },
    };
    await build5Db().doc(COL.TRANSACTION, order.uid).create(order);
    return order.uid;
  };
}
