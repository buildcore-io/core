/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, CollectionType, MediaStatus, Member, NftStatus } from '@soonaverse/interfaces';
import { randomBytes } from 'crypto';
import { Wallet } from 'ethers';
import { FieldValue } from 'firebase-admin/firestore';
import { get, last } from 'lodash';
import { FirebaseApp } from '../../../src/firebase/app/app';
import { Firestore } from '../../../src/firebase/firestore/firestore';
import { FirebaseStorage } from '../../../src/firebase/storage/storage';
import { getBucket } from '../../../src/utils/config.utils';
import { migrateUriToSotrage } from '../../../src/utils/media.utils';
import { AVATAR_COLLECTION_PROD_CONFIG, AVATAR_COLLECTION_TEST_CONFIG } from './avatar.roll_1';

export const rollMemberAvatars = async (app: FirebaseApp) => {
  let lastDocId = '';
  const db = new Firestore(app);
  do {
    const lastDoc = lastDocId
      ? await db.doc(`${COL.AVATARS}/${lastDocId}`).getSnapshot()
      : undefined;
    const snap = await db
      .collection(COL.AVATARS)
      .where('available', '==', false)
      .startAfter(lastDoc)
      .limit(200)
      .get<Record<string, unknown>>();
    lastDocId = (last(snap)?.uid as string) || '';

    const promises = snap.map(async (doc) => {
      const memberSnap = await db
        .collection(COL.MEMBER)
        .where('currentProfileImage.metadata', '==', doc.uid)
        .get<Member>();
      if (memberSnap.length) {
        await rollMemberAvatar(app, memberSnap[0]);
      }
    });
    await Promise.all(promises);
  } while (lastDocId);
};

const rollMemberAvatar = async (app: FirebaseApp, member: Member) => {
  const currentProfileImage = get(member, 'currentProfileImage');
  const isProd = app.getName() === 'soonaverse';
  const config = isProd ? AVATAR_COLLECTION_PROD_CONFIG : AVATAR_COLLECTION_TEST_CONFIG;

  const uid = getRandomEthAddress();

  const { avatar, fileName, metadata, original } = currentProfileImage;
  const uri = `https://ipfs.io/ipfs/${avatar}/${fileName}.png`;
  const storage = new FirebaseStorage(app);
  const bucket = storage.bucket(getBucket());
  const media = await migrateUriToSotrage(COL.NFT, member.uid, uid, uri, bucket);

  const nft = {
    uid,
    createdOn: FieldValue.serverTimestamp(),
    updatedOn: FieldValue.serverTimestamp(),
    createdBy: config.guardian,
    name: `Avatar ${fileName}`,
    description: `Nft for avatar ${fileName}`,
    collection: config.collection,
    owner: member.uid,
    isOwned: true,
    media,
    ipfsMedia: avatar,
    ipfsMetadata: metadata,
    ipfsRoot: original,
    type: CollectionType.CLASSIC,
    space: config.space,
    approved: true,
    rejected: false,
    properties: {},
    stats: {},
    placeholderNft: false,
    sold: true,
    status: NftStatus.PRE_MINTED,
    hidden: false,
    mediaStatus: MediaStatus.UPLOADED,
  };

  const db = new Firestore(app);
  const batch = db.batch();

  const nftDocRef = db.doc(`${COL.NFT}/${uid}`);
  batch.create(nftDocRef, nft);

  const memberDocRef = db.doc(`${COL.MEMBER}/${member.uid}`);
  batch.update(memberDocRef, {
    updatedOn: FieldValue.serverTimestamp(),
    currentProfileImage: FieldValue.delete(),
    avatarNft: uid,
    avatar: media,
  });

  await batch.commit();
};

function getRandomEthAddress() {
  const wallet = new Wallet('0x' + randomBytes(32).toString('hex'));
  return wallet.address.toLowerCase();
}

export const roll = rollMemberAvatars;
