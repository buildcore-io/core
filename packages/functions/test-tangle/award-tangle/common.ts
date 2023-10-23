import { IQuery, build5Db } from '@build-5/database';
import {
  COL,
  Network,
  Token,
  TokenStatus,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { serverTime } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { getRandomSymbol, wait } from '../../test/controls/common';
import { MEDIA } from '../../test/set-up';

export const awaitAllTransactionsForAward = async (awardId: string) => {
  const baseTransQuery = build5Db()
    .collection(COL.TRANSACTION)
    .where('payload.award', '==', awardId)
    .where('type', 'in', [TransactionType.BILL_PAYMENT, TransactionType.CREDIT]);
  await allConfirmed(baseTransQuery);

  const nttQuery = build5Db()
    .collection(COL.TRANSACTION)
    .where('payload.award', '==', awardId)
    .where('payload.type', '==', TransactionPayloadType.BADGE);
  await allConfirmed(nttQuery);
};

const allConfirmed = (query: IQuery) =>
  wait(async () => {
    const snap = await query.get<any>();
    const allConfirmed = snap.reduce(
      (acc, doc) => acc && doc?.payload?.walletReference?.confirmed,
      true,
    );
    return allConfirmed;
  });

export const saveBaseToken = async (space: string, guardian: string, network: Network) => {
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
      network,
    },
  };
  await build5Db().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token as Token;
};
