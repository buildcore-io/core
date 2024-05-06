import { IQuery, database } from '@buildcore/database';
import {
  COL,
  Network,
  SOON_PROJECT_ID,
  Token,
  TokenStatus,
  TransactionPayloadType,
  TransactionType,
} from '@buildcore/interfaces';
import { serverTime } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { getRandomSymbol, wait } from '../../test/controls/common';
import { MEDIA } from '../../test/set-up';

export const awaitAllTransactionsForAward = async (awardId: string) => {
  const baseTransQuery = database()
    .collection(COL.TRANSACTION)
    .where('payload_award', '==', awardId)
    .whereIn('type', [TransactionType.BILL_PAYMENT, TransactionType.CREDIT]);
  await allConfirmed(baseTransQuery);

  const nttQuery = database()
    .collection(COL.TRANSACTION)
    .where('payload_award', '==', awardId)
    .where('payload_type', '==', TransactionPayloadType.BADGE);
  await allConfirmed(nttQuery);
};

const allConfirmed = (query: IQuery<any, any>) =>
  wait(async () => {
    const snap = await query.get();
    const allConfirmed = snap.reduce(
      (acc, doc) => acc && doc?.payload?.walletReference?.confirmed,
      true,
    );
    return allConfirmed;
  });

export const saveBaseToken = async (space: string, guardian: string, network: Network) => {
  const token = {
    project: SOON_PROJECT_ID,
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
  } as Token;
  await database().doc(COL.TOKEN, token.uid).create(token);
  return token;
};
