import dayjs from "dayjs";
import { WEN_FUNC } from "../../interfaces/functions";
import { CollectionType } from "../../interfaces/models/collection";
import { createCollection } from '../../src/controls/collection.control';
import { createMember } from '../../src/controls/member.control';
import { createSpace } from '../../src/controls/space.control';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { WenError } from './../../interfaces/errors';
import { createNft } from './../../src/controls/nft.control';

describe('CollectionController: ' + WEN_FUNC.cCollection, () => {
  let walletSpy: any;
  let dummyAddress: any;
  let space: any;
  let collection: any;
  let member: any;

  const mocker = (params: any) => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: params
    }));
  }

  beforeEach(async () => {
    dummyAddress = wallet.getRandomEthAddress();
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: {}
    }));

    const wCreate: any = testEnv.wrap(createMember);
    member = await wCreate(dummyAddress);
    expect(member?.uid).toEqual(dummyAddress.toLowerCase());

    const wrappedSpace: any = testEnv.wrap(createSpace);
    space = await wrappedSpace();
    expect(space?.uid).toBeDefined();

    mocker({
      name: 'Collection A',
      description: 'babba',
      type: CollectionType.CLASSIC,
      royaltiesFee: 0.6,
      space: space.uid,
      royaltiesSpace: space.uid
    });

    const wrapped: any = testEnv.wrap(createCollection);
    collection = await wrapped();
    expect(collection?.uid).toBeDefined();
  });

  it('successfully create NFT', async () => {
    mocker({
      name: 'Collection A',
      description: 'babba',
      collection: collection.uid,
      availableFrom: dayjs().add(1, 'hour').toDate(),
      price: 10 * 1000 * 1000
    });
    const wrapped: any = testEnv.wrap(createNft);
    const returns = await wrapped();

    expect(returns?.createdOn).toBeDefined();
    expect(returns?.updatedOn).toBeDefined();
    walletSpy.mockRestore();
  });

  it('successfully create NFT to high buy price', async () => {
    mocker({
      name: 'Collection A',
      description: 'babba',
      collection: collection.uid,
      availableFrom: dayjs().add(1, 'hour').toDate(),
      price: 1000 * 1000 * 1000 * 1000 * 1000
    });

    const wrapped: any = testEnv.wrap(createNft);
    (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
    walletSpy.mockRestore();
  });

  it('successfully create NFT to high buy price - wrong collection', async () => {
    mocker({
      name: 'Collection A',
      description: 'babba',
      collection: wallet.getRandomEthAddress(),
      availableFrom: dayjs().add(1, 'hour').toDate(),
      price: 1000 * 1000 * 1000
    });

    const wrapped: any = testEnv.wrap(createNft);
    (<any>expect(wrapped())).rejects.toThrowError(WenError.collection_does_not_exists.key);
    walletSpy.mockRestore();
  });

  it('successfully create NFT to past date', async () => {
    mocker({
      name: 'Collection A',
      description: 'babba',
      collection: collection.uid,
      availableFrom: dayjs().subtract(1, 'hour').toDate(),
      price: 10 * 1000 * 1000
    });

    const wrapped: any = testEnv.wrap(createNft);
    (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
    walletSpy.mockRestore();
  });

  it('successfully create NFT - validate space/type', async () => {
    mocker({
      name: 'Collection A',
      description: 'babba',
      collection: collection.uid,
      availableFrom: dayjs().add(1, 'hour').toDate(),
      price: 10 * 1000 * 1000
    });
    const wrapped: any = testEnv.wrap(createNft);
    const returns = await wrapped();

    expect(returns?.createdOn).toBeDefined();
    expect(returns?.updatedOn).toBeDefined();
    expect(returns?.space).toBe(space.uid);
    expect(returns?.type).toBe(CollectionType.CLASSIC);
    expect(returns?.hidden).toBe(false);
    walletSpy.mockRestore();
  });
});
