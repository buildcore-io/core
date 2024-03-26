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
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { uploadMediaToWeb3 } from '../../src/cron/media.cron';
import { dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomSymbol, wait } from '../../test/controls/common';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { CollectionMintHelper } from '../collection-minting/Helper';
import { requestFundsFromFaucet } from '../faucet';

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
  } as Token;
  await build5Db().doc(COL.TOKEN, token.uid).create(token);
  await build5Db()
    .doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member)
    .upsert({ tokenOwned: 1000 });
  return <Token>token;
};

describe('Web3 cron test', () => {
  const h = new CollectionMintHelper();

  beforeEach(async () => {
    await cleanupPendingUploads();
  });

  it('Should upload collection&nft media on mint', async () => {
    await h.beforeAll();
    await h.beforeEach();

    const count = 5;
    await build5Db().doc(COL.COLLECTION, h.collection).update({ total: count });
    const promises = Array.from(Array(count)).map(() => {
      const nft = h.createDummyNft(h.collection!, h.getRandomDescrptiron());
      return build5Db()
        .doc(COL.NFT, nft.uid)
        .create({
          ...nft,
          availableFrom: dateToTimestamp(nft.availableFrom),
          project: SOON_PROJECT_ID,
        } as any);
    });
    await Promise.all(promises);
    await h.mintCollection();

    await uploadMediaToWeb3();

    const collectionDocRef = build5Db().doc(COL.COLLECTION, h.collection);
    const collection = <Collection>await collectionDocRef.get();
    expect(collection.mintingData?.nftMediaToUpload).toBe(0);
    expect(collection.mediaStatus).toBe(MediaStatus.UPLOADED);
  });

  it('Should upload token media on mint', async () => {
    const guardianId = await testEnv.createMember();
    const member = await testEnv.createMember();
    const guardian = <Member>await build5Db().doc(COL.MEMBER, guardianId).get();
    const space = await testEnv.createSpace(guardian.uid);
    let token = await saveToken(space.uid, guardian.uid, member);
    mockWalletReturnValue(guardian.uid, { token: token.uid, network });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.mintTokenOrder);
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const tokenDocRef = build5Db().doc(COL.TOKEN, token.uid);
    await wait(async () => {
      const snap = await tokenDocRef.get();
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
    const snap = await pendingUploadsQuery(col as COL.TOKEN).get();
    const promises = snap.map((d) => {
      const docRef = build5Db().doc(col as COL.TOKEN, d.uid);
      return docRef.update({ mediaStatus: undefined });
    });
    await Promise.all(promises);
  }
};

const pendingUploadsQuery = (col: COL.TOKEN | COL.NFT | COL.COLLECTION) =>
  build5Db()
    .collection(col as COL.TOKEN)
    .where('mediaStatus', '==', MediaStatus.PENDING_UPLOAD);
