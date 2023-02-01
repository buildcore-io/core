import {
  COL,
  Collection,
  MediaStatus,
  Member,
  Network,
  Nft,
  SUB_COL,
  Token,
  TokenStatus,
} from '@soonaverse/interfaces';
import { Web3Storage } from 'web3.storage';
import admin from '../src/admin.config';
import { mintTokenOrder } from '../src/controls/token-minting/token-mint.control';
import { uploadMediaToWeb3 } from '../src/cron/media.cron';
import { collectionToIpfsMetadata, nftToIpfsMetadata } from '../src/utils/car.utils';
import { getWeb3Token } from '../src/utils/config.utils';
import { serverTime } from '../src/utils/dateTime.utils';
import * as wallet from '../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  getRandomSymbol,
  mockWalletReturnValue,
  wait,
} from '../test/controls/common';
import { MEDIA, testEnv } from '../test/set-up';
import { CollectionMintHelper } from './collection-minting/Helper';
import { requestFundsFromFaucet } from './faucet';

let walletSpy: any;
const network = Network.RMS;
const totalSupply = 1500;

const saveToken = async (space: string, guardian: string, member: string) => {
  const tokenId = wallet.getRandomEthAddress();
  const token = {
    symbol: getRandomSymbol(),
    totalSupply,
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: tokenId,
    createdBy: guardian,
    name: 'MyToken',
    status: TokenStatus.AVAILABLE,
    access: 0,
    icon: MEDIA,
  };
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  await admin
    .firestore()
    .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`)
    .set({ tokenOwned: 1000 });
  return <Token>token;
};

describe('Web3 cron test', () => {
  const collectionHelper = new CollectionMintHelper();

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    await cleanupPendingUploads();
  });

  it('Should upload collection&nft media on mint', async () => {
    await collectionHelper.beforeAll();
    await collectionHelper.beforeEach();

    const count = 5;
    await admin
      .firestore()
      .doc(`${COL.COLLECTION}/${collectionHelper.collection}`)
      .update({ total: count });
    const promises = Array.from(Array(count)).map(() => {
      const nft = collectionHelper.createDummyNft(
        collectionHelper.collection!,
        collectionHelper.getRandomDescrptiron(),
      );
      return admin.firestore().doc(`${COL.NFT}/${nft.uid}`).create(nft);
    });
    await Promise.all(promises);
    await collectionHelper.mintCollection();

    await uploadMediaToWeb3();

    const client = new Web3Storage({ token: getWeb3Token() });
    const collectionDocRef = admin
      .firestore()
      .doc(`${COL.COLLECTION}/${collectionHelper.collection}`);
    const collection = <Collection>(await collectionDocRef.get()).data();
    expect(collection.mintingData?.nftMediaToUpload).toBe(0);
    const collectionWeb3Status = await client.status(collection.ipfsRoot!);
    expect(collectionWeb3Status?.pins[0]?.status).toBe('Pinned');

    const nfts = (
      await admin
        .firestore()
        .collection(COL.NFT)
        .where('collection', '==', collectionHelper.collection)
        .get()
    ).docs.map((d) => <Nft>d.data());
    const nftPinPromises = nfts.map(
      async (nft) => (await client.status(nft.ipfsRoot!))?.pins[0]?.status,
    );
    const allNftsArePinned = (await Promise.all(nftPinPromises)).reduce(
      (acc, act) => acc && act === 'Pinned',
      true,
    );
    expect(allNftsArePinned).toBe(true);
  });

  it('Should upload token media on mint', async () => {
    const guardianId = await createMember(walletSpy);
    const member = await createMember(walletSpy);
    const guardian = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${guardianId}`).get()).data()
    );
    const space = await createSpace(walletSpy, guardian.uid);
    let token = await saveToken(space.uid, guardian.uid, member);
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network });
    const order = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
    await wait(async () => {
      const snap = await tokenDocRef.get();
      return snap.data()?.status === TokenStatus.MINTED;
    });

    await uploadMediaToWeb3();

    token = <Token>(await tokenDocRef.get()).data();
    expect(token.status).toBe(TokenStatus.MINTED);
    expect(token.ipfsMedia).toBeDefined();
    expect(token.ipfsMetadata).toBeDefined();
    expect(token.ipfsRoot).toBeDefined();
    expect(token.mediaStatus).toBe(MediaStatus.UPLOADED);

    const client = new Web3Storage({ token: getWeb3Token() });
    const tokenWeb3Status = await client.status(token.ipfsRoot!);
    expect(tokenWeb3Status?.pins[0]?.status).toBe('Pinned');
  });

  it('Should set metadata.json correctly', async () => {
    await collectionHelper.beforeAll();
    await collectionHelper.beforeEach();

    const collectionDocRef = admin
      .firestore()
      .doc(`${COL.COLLECTION}/${collectionHelper.collection}`);
    const collection = <Collection>(await collectionDocRef.get()).data();
    const nft = collectionHelper.createDummyNft(collection.uid, collectionHelper.space!.uid) as any;

    const nftMetadata = nftToIpfsMetadata(collection, nft);
    expect(nftMetadata.name).toBe(nft.name);
    expect(nftMetadata.description).toBe(nft.description);
    expect(nftMetadata.author).toBe(nft.createdBy);
    expect(nftMetadata.space).toBe(nft.space);
    expect(nftMetadata.royaltySpace).toBe(collection.royaltiesSpace);
    expect(nftMetadata.uid).toBe(nft.uid);
    expect(nftMetadata.attributes).toEqual([
      { trait_type: 'custom', value: 'custom' },
      { trait_type: 'customStat', value: 'customStat' },
    ]);
    expect(nftMetadata.collectionId).toBe(collection.uid);

    const collectionMetadata = collectionToIpfsMetadata(collection);
    expect(collectionMetadata.name).toBe(collection.name);
    expect(collectionMetadata.description).toBe(collection.description);
    expect(collectionMetadata.author).toBe(collection.createdBy);
    expect(collectionMetadata.space).toBe(collection.space);
    expect(collectionMetadata.royaltySpace).toBe(collection.royaltiesSpace);
    expect(collectionMetadata.uid).toBe(collection.uid);
  });

  afterEach(async () => {
    await cleanupPendingUploads();
  });
});

const cleanupPendingUploads = async () => {
  for (const col of [COL.TOKEN, COL.NFT, COL.COLLECTION]) {
    const snap = await pendingUploadsQuery(col).get();
    const promises = snap.docs.map((d) =>
      d.ref.update({ mediaStatus: admin.firestore.FieldValue.delete() }),
    );
    await Promise.all(promises);
  }
};

const pendingUploadsQuery = (col: COL) =>
  admin.firestore().collection(col).where('mediaStatus', '==', MediaStatus.PENDING_UPLOAD);
