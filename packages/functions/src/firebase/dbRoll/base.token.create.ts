import { COL, Network, SUB_COL, TokenStatus } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import admin from '../../admin.config';
import { WalletService } from '../../services/wallet/wallet';
import { isProdEnv } from '../../utils/config.utils';
import { cOn } from '../../utils/dateTime.utils';

export const SMR_TOKEN_UID = '0x88e49b83d2039c528cacc8b5b05c38143723499c';
export const RMS_TOKEN_UID = '0x3bfdb4658af6b30d5c400f282154dd7a9d292716';
export const SMR_SPACE_UID = '0x8f234f4ca4cb6fd06ddf1af142a4409bf7b40863';
export const RMS_SPACE_UID = '0xb0f67cbab367f08b44c33af5836ef8b7d91610fc';
export const GUARDIAN_UID = '0x551fd2c7c7bf356bac194587dab2fcd46420054b';

export const createbaseTokens = functions.runWith({ maxInstances: 1 }).https.onRequest((_, res) =>
  admin.firestore().runTransaction(async (transaction) => {
    await assertIsFirstRun(transaction);
    await createTokenAndSpace(transaction, SMR_TOKEN_UID, SMR_SPACE_UID, Network.SMR);
    if (!isProdEnv()) {
      await createTokenAndSpace(transaction, RMS_TOKEN_UID, RMS_SPACE_UID, Network.RMS);
    }
    res.sendStatus(200);
  }),
);

const assertIsFirstRun = async (transaction: admin.firestore.Transaction) => {
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${SMR_SPACE_UID}`);

  const spaceSnap = await transaction.get(spaceDocRef);
  if (spaceSnap.exists) {
    throw Error('Base tokens already exist');
  }
};

const createTokenAndSpace = async (
  transaction: admin.firestore.Transaction,
  tokenId: string,
  spaceId: string,
  network: Network,
) => {
  const wallet = await WalletService.newWallet(network);
  const vaultAddress = await wallet.getNewIotaAddressDetails();

  const space = {
    id: spaceId,
    wenUrl: `https://soonaverse.com/space/${spaceId}`,
    totalPendingMembers: 0,
    vaultAddress: vaultAddress.bech32,
    rank: 1,
    createdBy: GUARDIAN_UID,
    name: network.toUpperCase(),
    open: null,
    totalMembers: 1,
    discord: null,
    totalGuardians: 1,
    uid: spaceId,
  };
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${spaceId}`);
  transaction.create(spaceDocRef, cOn(space));

  const guardian = { id: GUARDIAN_UID, parentCol: 'space', uid: GUARDIAN_UID, parentId: spaceId };
  const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(GUARDIAN_UID);
  transaction.create(guardianDocRef, cOn(guardian));

  const token = {
    id: tokenId,
    createdBy: GUARDIAN_UID,
    shortDescription: network.toUpperCase(),
    mintingData: { network, networkFormat: network },
    uid: tokenId,
    status: TokenStatus.BASE,
    space: space.uid,
    name: network.toUpperCase(),
    pricePerToken: 1,
    totalAirdropped: 0,
    public: false,
    approved: true,
    rejected: false,
    allocations: [{ percentage: '100', title: 'Supply', isPublicSale: false }],
    totalDeposit: 0,
    shortDescriptionTitle: network.toUpperCase(),
    access: 0,
    symbol: network.toUpperCase(),
    title: network.toUpperCase(),
  };
  const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
  transaction.create(tokenDocRef, cOn(token));
};
