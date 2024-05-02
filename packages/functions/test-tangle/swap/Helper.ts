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
  Transaction,
  TransactionPayloadType,
  TransactionType,
  UnsoldMintingOptions,
  WEN_FUNC,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { set } from 'lodash';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import * as wallet from '../../src/utils/wallet.utils';
import { submitMilestoneFunc, wait } from '../../test/controls/common';
import { MEDIA, getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

export class Helper {
  public network = Network.RMS;
  public guardian: string = {} as any;
  public member: string = {} as any;
  public wallet: Wallet = {} as any;
  public collection: string = {} as any;
  public space: Space = {} as any;

  public beforeAll = async () => {
    this.wallet = await getWallet(this.network);
  };

  public beforeEach = async () => {
    this.guardian = await testEnv.createMember();
    this.space = await testEnv.createSpace(this.guardian);
    this.member = await testEnv.createMember();
  };

  public createDummyNft = (collection: string, description = 'babba') => ({
    name: 'NFT ' + description,
    description,
    collection,
    availableFrom: dayjs().add(1, 'hour').toDate(),
    price: 10 * 1000 * 1000,
    uid: wallet.getRandomEthAddress(),
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
    const collectionDocRef = build5Db().doc(COL.COLLECTION, this.collection);
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
      await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.MINT_COLLECTION)
        .where('payload_type', '==', TransactionPayloadType.SEND_ALIAS_TO_GUARDIAN)
        .where('member', '==', this.guardian)
        .get()
    ).map((d) => <Transaction>d);

    expect(ownerChangeTran.length).toBe(1);
    expect(ownerChangeTran[0].payload?.walletReference?.confirmed).toBe(true);
  };

  public createAndOrderNft = async (buyAndAuctionId = false, shouldBid = false) => {
    let nft: any = this.createDummyNft(this.collection!);
    delete nft.uid;
    delete nft.status;
    delete nft.placeholderNft;
    mockWalletReturnValue(this.guardian!, nft);
    nft = await testEnv.wrap<Nft>(WEN_FUNC.createNft);

    if (buyAndAuctionId) {
      await build5Db()
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
      await wait(async () => (await build5Db().doc(COL.NFT, nft.uid).get())?.available === 3);

      if (shouldBid) {
        mockWalletReturnValue(this.member!, { nft: nft.uid });
        const bidOrder = await testEnv.wrap<Transaction>(WEN_FUNC.openBid);
        await submitMilestoneFunc(bidOrder, 2 * MIN_IOTA_AMOUNT);
      }
    }
    return <Nft>await build5Db().doc(COL.NFT, nft.uid).get();
  };

  public dummyAuctionData = (uid: string) => ({
    nft: uid,
    price: MIN_IOTA_AMOUNT,
    availableFrom: dayjs().toDate(),
    auctionFrom: dayjs().toDate(),
    auctionFloorPrice: MIN_IOTA_AMOUNT,
    auctionLength: 60000 * 4,
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

export const VAULT_MNEMONIC_1 =
  'lift primary tornado antenna confirm smoke oxygen rescue drift tenant mirror small barrel people predict elevator retreat hold various adjust keep decade valve scheme';
export const MINTED_TOKEN_ID_1 =
  '0x08c9c7b7e22a43ed9f14fdcc876bd9fb56e10ccac4b3c2299013d71b363db801a40100000000';

export const VAULT_MNEMONIC_2 =
  'egg festival about walnut drama exclude thrive chest edge hollow miss civil turkey april toast survey already mail sign fire exile rack kidney wagon';
export const MINTED_TOKEN_ID_2 =
  '0x0844694a6b67ba375246148afd9cca94d7a3d06e91d77c51f2cc4e68dcb69508ba0100000000';
