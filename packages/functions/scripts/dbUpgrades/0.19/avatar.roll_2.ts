/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, CollectionType, MediaStatus, Member, NftStatus } from '@soonaverse/interfaces';
import { randomBytes } from 'crypto';
import { Wallet } from 'ethers';
import { App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { get, last } from 'lodash';
import { getBucket } from '../../../src/utils/config.utils';
import { migrateUriToSotrage } from '../../../src/utils/media.utils';
import { AVATAR_COLLECTION_PROD_CONFIG, AVATAR_COLLECTION_TEST_CONFIG } from './avatar.roll_1';

export const rollMemberAvatars = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;

  do {
    let query = db.collection(COL.AVATARS).where('available', '==', false).limit(200);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const promises = snap.docs.map(async (doc) => {
      const memberSnap = await db
        .collection(COL.MEMBER)
        .where('currentProfileImage.metadata', '==', doc.id)
        .get();
      if (memberSnap.size) {
        await rollMemberAvatar(app, memberSnap.docs[0].data() as Member);
      }
    });
    await Promise.all(promises);
  } while (lastDoc);
};

const rollMemberAvatar = async (app: App, member: Member) => {
  const currentProfileImage = get(member, 'currentProfileImage');
  const isProd = app.options.projectId === 'soonaverse';
  const config = isProd ? AVATAR_COLLECTION_PROD_CONFIG : AVATAR_COLLECTION_TEST_CONFIG;

  const storage = getStorage(app);
  const bucket = storage.bucket(getBucket());

  const uid = getRandomEthAddress();

  const { avatar, fileName, metadata, original } = currentProfileImage;
  const uri = `https://ipfs.io/ipfs/${avatar}/${fileName}.png`;
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

  const db = getFirestore(app);
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
