import { database, PgToken } from '@buildcore/database';
import {
  COL,
  Collection,
  SUB_COL,
  Token,
  TokenAllocation,
  TokenDropStatus,
  TokenStatus,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import bigDecimal from 'js-big-decimal';
import { head } from 'lodash';
import { invalidArgument } from './error.utils';

export const BIG_DECIMAL_PRECISION = 1000;

export const tokenOrderTransactionDocId = (member: string, token: Token | PgToken) =>
  member + token.uid;

export const allPaymentsQuery = (member: string, token: string) =>
  database()
    .collection(COL.TRANSACTION)
    .where('member', '==', member)
    .where('payload_token', '==', token);

export const orderDocRef = (member: string, token: Token | PgToken) =>
  database().doc(COL.TRANSACTION, tokenOrderTransactionDocId(member, token));

export const memberDocRef = (member: string) => database().doc(COL.MEMBER, member);

export const assertIsGuardian = async (space: string, member: string) => {
  const guardianDoc = await database().doc(COL.SPACE, space, SUB_COL.GUARDIANS, member).get();
  if (!guardianDoc) {
    throw invalidArgument(WenError.you_are_not_guardian_of_space);
  }
};

export const assertIsTokenGuardian = async (token: Token, member: string) => {
  if (token.space) {
    await assertIsGuardian(token.space, member);
  } else if (token.createdBy !== member) {
    throw invalidArgument(WenError.you_must_be_the_creator_of_this_token);
  }
};

export const assertIsCollectionGuardian = async (collection: Collection, member: string) => {
  if (collection.space) {
    await assertIsGuardian(collection.space, member);
  } else if (collection.createdBy !== member) {
    throw invalidArgument(WenError.you_must_be_the_creator_of_this_collection);
  }
};

export const assertTokenApproved = (token: Token, approvedIfPublic?: boolean) => {
  if (approvedIfPublic && token.public) {
    return;
  }
  if (!token.approved || token.rejected) {
    throw invalidArgument(WenError.token_not_approved);
  }
};

export const getBoughtByMemberDiff = (
  prevTotalDeposit: number,
  currTotalDeposit: number,
  pricePerToken: number,
) => {
  const prevOrderCount = bigDecimal.floor(
    bigDecimal.divide(prevTotalDeposit, pricePerToken, BIG_DECIMAL_PRECISION),
  );
  const currentOrderCount = bigDecimal.floor(
    bigDecimal.divide(currTotalDeposit, pricePerToken, BIG_DECIMAL_PRECISION),
  );
  return Number(bigDecimal.subtract(currentOrderCount, prevOrderCount));
};

export const getTotalPublicSupply = (token: Token | PgToken) => {
  const publicPercentage =
    (token.allocations! as TokenAllocation[]).find((a) => a.isPublicSale)?.percentage || 0;
  return Number(bigDecimal.floor(bigDecimal.multiply(token.totalSupply, publicPercentage / 100)));
};

export const assertTokenStatus = (token: Token, validStatuses: TokenStatus[]) => {
  if (!validStatuses.includes(token.status)) {
    throw invalidArgument(WenError.token_in_invalid_status);
  }
};

export const tokenIsInPublicSalePeriod = (token: Token) =>
  token.saleStartDate &&
  token.saleLength &&
  dayjs().isAfter(dayjs(token.saleStartDate?.toDate())) &&
  dayjs().isBefore(dayjs(token.saleStartDate.toDate()).add(token.saleLength, 'ms'));

export const tokenIsInCoolDownPeriod = (token: Token) =>
  token.saleStartDate &&
  token.saleLength &&
  token.coolDownEnd &&
  dayjs().isAfter(dayjs(token.saleStartDate.toDate()).add(token.saleLength, 'ms')) &&
  dayjs().isBefore(dayjs(token.coolDownEnd.toDate()));

export const getTokenForSpace = async (space: string) => {
  let snap = await database()
    .collection(COL.TOKEN)
    .where('space', '==', space)
    .where('approved', '==', true)
    .limit(1)
    .get();
  if (snap.length) {
    return <Token>snap[0];
  }
  snap = await database()
    .collection(COL.TOKEN)
    .where('space', '==', space)
    .where('public', '==', true)
    .limit(1)
    .get();
  return <Token | undefined>snap[0];
};

export const getUnclaimedDrops = (token: string, member: string) =>
  database()
    .collection(COL.AIRDROP)
    .where('token', '==', token)
    .where('member', '==', member)
    .where('status', '==', TokenDropStatus.UNCLAIMED)
    .get();

export const getTokenBySymbol = async (symbol: string) => {
  let snap = await database()
    .collection(COL.TOKEN)
    .where('symbol', '==', symbol.toUpperCase())
    .where('approved', '==', true)
    .get();
  if (snap.length) {
    return head(snap);
  }
  snap = await database()
    .collection(COL.TOKEN)
    .where('symbol', '==', symbol.toUpperCase())
    .where('public', '==', true)
    .get();
  return head(snap);
};

export const getTokenByMintId = async (tokenId: string) => {
  const snap = await database()
    .collection(COL.TOKEN)
    .where('mintingData_tokenId', '==', tokenId)
    .get();
  return <Token | undefined>snap[0];
};
