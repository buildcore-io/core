/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import {
  Access,
  Categories,
  COL,
  Collection,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftAccess,
  NftStatus,
  Space,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { submitMilestoneFunc } from '../../test/controls/common';
import { getWallet, MEDIA, mockWalletReturnValue, testEnv } from '../../test/set-up';

export class Helper {
  public network = Network.RMS;
  public collection: string = {} as any;
  public guardian: string = {} as any;
  public guardianAddress: AddressDetails = {} as any;
  public space: Space = {} as any;
  public royaltySpace: Space = {} as any;
  public walletService: Wallet = {} as any;
  public nft: Nft = {} as any;

  public beforeAll = async () => {
    this.walletService = await getWallet(this.network);
  };

  public beforeEach = async (collectionType = CollectionType.CLASSIC) => {
    this.guardian = await testEnv.createMember();
    const guardianDocRef = build5Db().doc(COL.MEMBER, this.guardian);
    const guardianData = await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, this.network);
    this.guardianAddress = await this.walletService.getAddressDetails(guardianBech32);

    this.space = await testEnv.createSpace(this.guardian);
    this.royaltySpace = await testEnv.createSpace(this.guardian);

    mockWalletReturnValue(
      this.guardian,
      this.createDummyCollection(this.space.uid, this.royaltySpace.uid, collectionType),
    );
    this.collection = (await testEnv.wrap<Collection>(WEN_FUNC.createCollection)).uid;

    await build5Db().doc(COL.COLLECTION, this.collection).update({ approved: true });
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

  public dummyAuctionData = (uid: string, availableFrom?: Date, auctionFrom?: Date) => ({
    nft: uid,
    price: MIN_IOTA_AMOUNT,
    availableFrom: availableFrom || dayjs().toDate(),
    auctionFrom: auctionFrom || dayjs().toDate(),
    auctionFloorPrice: MIN_IOTA_AMOUNT,
    auctionLength: 60000 * 4,
    access: NftAccess.OPEN,
  });

  public dummySaleData = (uid: string) => ({
    nft: uid,
    price: 12 * MIN_IOTA_AMOUNT,
    availableFrom: dayjs().toDate(),
    access: NftAccess.OPEN,
  });
}
