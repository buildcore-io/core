/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import {
  Access,
  COL,
  Categories,
  Collection,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Member,
  Network,
  NetworkAddress,
  Nft,
  Space,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';

export class Helper {
  public member: string = {} as any;
  public memberAddress: AddressDetails = {} as any;
  public space: Space = {} as any;
  public walletService: Wallet = {} as any;
  public member2: string = {} as any;

  public beforeEach = async () => {
    this.member = await testEnv.createMember();
    this.member2 = await testEnv.createMember();
    this.space = await testEnv.createSpace(this.member);
    this.walletService = await getWallet(Network.ATOI);

    const memberData = <Member>await database().doc(COL.MEMBER, this.member).get();
    this.memberAddress = await this.walletService!.getAddressDetails(
      getAddress(memberData, Network.ATOI),
    );
  };

  public createCollectionAndNft = async <T>(
    address: NetworkAddress,
    space: Space,
    type = CollectionType.CLASSIC,
  ) => {
    mockWalletReturnValue(address, this.dummyCollection(space, type));
    const cCollection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    expect(cCollection?.uid).toBeDefined();

    await database().doc(COL.COLLECTION, cCollection?.uid).update({ approved: true });
    const collection = <Collection>cCollection;

    const nft = await this.createNft(address, collection);
    return { nft, collection };
  };

  public createNft = async (address: NetworkAddress, collection: Collection) => {
    mockWalletReturnValue(address, this.dummyNft(collection));
    const nft = await testEnv.wrap<Nft>(WEN_FUNC.createNft);
    expect(nft?.createdOn).toBeDefined();
    return <Nft>nft;
  };

  public dummyCollection = (
    space: Space,
    type: CollectionType,
    ro = 0.5,
    priceMi = 1,
    date: Date = dayjs().subtract(1, 'minute').toDate(),
  ) => ({
    name: 'Collection',
    description: 'babba',
    type,
    category: Categories.ART,
    access: Access.OPEN,
    royaltiesFee: ro,
    space: space.uid,
    royaltiesSpace: space.uid,
    onePerMemberOnly: false,
    availableFrom: date,
    price: priceMi * MIN_IOTA_AMOUNT,
  });

  public dummyNft = (
    collection: Collection,
    priceMi = 1,
    date: Date = dayjs().subtract(1, 'minute').toDate(),
  ) => ({
    name: 'Collection A',
    description: 'babba',
    collection: collection.uid,
    availableFrom: date,
    price: priceMi * MIN_IOTA_AMOUNT,
  });
}
