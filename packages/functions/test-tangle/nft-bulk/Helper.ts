/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
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
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { createCollection } from '../../src/runtime/firebase/collection';
import { createNft } from '../../src/runtime/firebase/nft';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import * as wallet from '../../src/utils/wallet.utils';
import {
  createMember as createMemberTest,
  createSpace,
  mockWalletReturnValue,
} from '../../test/controls/common';
import { getWallet, testEnv } from '../../test/set-up';

export class Helper {
  public walletSpy: any = {} as any;
  public member: string = {} as any;
  public memberAddress: AddressDetails = {} as any;
  public space: Space = {} as any;
  public walletService: Wallet = {} as any;
  public member2: string = {} as any;

  public beforeEach = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.member = await createMemberTest(this.walletSpy);
    this.member2 = await createMemberTest(this.walletSpy);
    this.space = await createSpace(this.walletSpy, this.member);
    this.walletService = await getWallet(Network.ATOI);

    const memberData = <Member>await build5Db().doc(`${COL.MEMBER}/${this.member}`).get();
    this.memberAddress = await this.walletService!.getAddressDetails(
      getAddress(memberData, Network.ATOI),
    );
  };

  public createColletionAndNft = async <T>(
    address: NetworkAddress,
    space: Space,
    type = CollectionType.CLASSIC,
  ) => {
    mockWalletReturnValue(this.walletSpy, address, this.dummyCollection(space, type));
    const cCollection = await testEnv.wrap(createCollection)({});
    expect(cCollection?.uid).toBeDefined();

    await build5Db().doc(`${COL.COLLECTION}/${cCollection?.uid}`).update({ approved: true });
    const collection = <Collection>cCollection;

    const nft = await this.createNft(address, collection);
    return { nft, collection };
  };

  public createNft = async (address: NetworkAddress, collection: Collection) => {
    mockWalletReturnValue(this.walletSpy, address, this.dummyNft(collection));
    const nft = await testEnv.wrap(createNft)({});
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
