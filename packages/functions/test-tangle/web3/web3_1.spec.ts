import { build5Db } from '@build-5/database';
import {
  COL,
  Collection,
  MediaStatus,
  Member,
  Network,
  SOON_PROJECT_ID,
  SUB_COL,
  Token,
  TokenStatus,
} from '@build-5/interfaces';
import { uploadMediaToWeb3 } from '../../src/cron/media.cron';
import { mintTokenOrder } from '../../src/runtime/firebase/token/minting';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  getRandomSymbol,
  mockWalletReturnValue,
  wait,
} from '../../test/controls/common';
import { MEDIA, testEnv } from '../../test/set-up';
import { CollectionMintHelper } from '../collection-minting/Helper';
import { requestFundsFromFaucet } from '../faucet';

let walletSpy: any;
const network = Network.RMS;
const totalSupply = 1500;

const saveToken = async (space: string, guardian: string, member: string) => {
  const tokenId = wallet.getRandomEthAddress();
  const token = {
    project: SOON_PROJECT_ID,
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
  await build5Db().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  await build5Db()
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
    await build5Db()
      .doc(`${COL.COLLECTION}/${collectionHelper.collection}`)
      .update({ total: count });
    const promises = Array.from(Array(count)).map(() => {
      const nft = collectionHelper.createDummyNft(
        collectionHelper.collection!,
        collectionHelper.getRandomDescrptiron(),
      );
      return build5Db()
        .doc(`${COL.NFT}/${nft.uid}`)
        .create({ ...nft, project: SOON_PROJECT_ID });
    });
    await Promise.all(promises);
    await collectionHelper.mintCollection();

    await uploadMediaToWeb3();

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${collectionHelper.collection}`);
    const collection = <Collection>await collectionDocRef.get();
    expect(collection.mintingData?.nftMediaToUpload).toBe(0);
  });

  it('Should upload token media on mint', async () => {
    const guardianId = await createMember(walletSpy);
    const member = await createMember(walletSpy);
    const guardian = <Member>await build5Db().doc(`${COL.MEMBER}/${guardianId}`).get();
    const space = await createSpace(walletSpy, guardian.uid);
    let token = await saveToken(space.uid, guardian.uid, member);
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network });
    const order = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token.uid}`);
    await wait(async () => {
      const snap = await tokenDocRef.get<Token>();
      return snap?.status === TokenStatus.MINTED;
    });

    await uploadMediaToWeb3();

    token = <Token>await tokenDocRef.get();
    expect(token.status).toBe(TokenStatus.MINTED);
    expect(token.ipfsMedia).toBeDefined();
    expect(token.ipfsMetadata).toBeDefined();
    expect(token.ipfsRoot).toBeDefined();
    expect(token.mediaStatus).toBe(MediaStatus.UPLOADED);
  });

  afterEach(async () => {
    await cleanupPendingUploads();
  });
});

const cleanupPendingUploads = async () => {
  for (const col of [COL.TOKEN, COL.NFT, COL.COLLECTION]) {
    const snap = await pendingUploadsQuery(col).get<Record<string, unknown>>();
    const promises = snap.map((d) => {
      const docRef = build5Db().doc(`${col}/${d.uid}`);
      return docRef.update({ mediaStatus: build5Db().deleteField() });
    });
    await Promise.all(promises);
  }
};

const pendingUploadsQuery = (col: COL) =>
  build5Db().collection(col).where('mediaStatus', '==', MediaStatus.PENDING_UPLOAD);
