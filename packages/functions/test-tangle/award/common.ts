import {
  COL,
  Network,
  Token,
  TokenStatus,
  TransactionAwardType,
  TransactionType,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { serverTime } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { getRandomSymbol, wait } from '../../test/controls/common';
import { MEDIA } from '../../test/set-up';

export const awaitAllTransactionsForAward = async (awardId: string) => {
  const baseTransQuery = admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('payload.award', '==', awardId)
    .where('type', 'in', [TransactionType.BILL_PAYMENT, TransactionType.CREDIT]);
  await allConfirmed(baseTransQuery);

  const nttQuery = admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('payload.award', '==', awardId)
    .where('payload.type', '==', TransactionAwardType.BADGE);
  await allConfirmed(nttQuery);
};

const allConfirmed = (query: admin.firestore.Query<admin.firestore.DocumentData>) =>
  wait(async () => {
    const snap = await query.get();
    const allConfirmed = snap.docs.reduce(
      (acc, doc) => acc && doc.data()?.payload?.walletReference?.confirmed,
      true,
    );
    return allConfirmed;
  });

export const saveBaseToken = async (space: string, guardian: string) => {
  const token = {
    symbol: getRandomSymbol(),
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: getRandomEthAddress(),
    createdBy: guardian,
    name: 'MyToken',
    status: TokenStatus.BASE,
    access: 0,
    icon: MEDIA,
    mintingData: {
      network: Network.RMS,
    },
  };
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token as Token;
};
