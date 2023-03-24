import {
  COL,
  SUB_COL,
  Token,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import bigDecimal from 'js-big-decimal';
import { last } from 'lodash';
import { getSnapshot, soonDb } from '../firebase/firestore/soondb';
import { throwInvalidArgument } from './error.utils';

export const BIG_DECIMAL_PRECISION = 1000;

export const tokenOrderTransactionDocId = (member: string, token: Token) =>
  member + '_' + token.uid;

export const allPaymentsQuery = (member: string, token: string) =>
  soonDb()
    .collection(COL.TRANSACTION)
    .where('member', '==', member)
    .where('payload.token', '==', token);

export const orderDocRef = (member: string, token: Token) =>
  soonDb().doc(`${COL.TRANSACTION}/${tokenOrderTransactionDocId(member, token)}`);

export const memberDocRef = (member: string) => soonDb().doc(`${COL.MEMBER}/${member}`);

export const assertIsGuardian = async (space: string, member: string) => {
  const guardianDoc = await soonDb()
    .doc(`${COL.SPACE}/${space}/${SUB_COL.GUARDIANS}/${member}`)
    .get();
  if (!guardianDoc) {
    throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
  }
};

export const assertTokenApproved = (token: Token, approvedIfPublic?: boolean) => {
  if (approvedIfPublic && token.public) {
    return;
  }
  if (!token.approved || token.rejected) {
    throw throwInvalidArgument(WenError.token_not_approved);
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

export const getTotalPublicSupply = (token: Token) => {
  const publicPercentage = token.allocations.find((a) => a.isPublicSale)?.percentage || 0;
  return Number(bigDecimal.floor(bigDecimal.multiply(token.totalSupply, publicPercentage / 100)));
};

export const assertTokenStatus = (token: Token, validStatuses: TokenStatus[]) => {
  if (!validStatuses.includes(token.status)) {
    throw throwInvalidArgument(WenError.token_in_invalid_status);
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

export const getSoonToken = async () => {
  const snap = await soonDb().collection(COL.TOKEN).where('symbol', '==', 'SOON').limit(1).get();
  return <Token>snap[0];
};

export const getTokenForSpace = async (space: string) => {
  let snap = await soonDb()
    .collection(COL.TOKEN)
    .where('space', '==', space)
    .where('approved', '==', true)
    .limit(1)
    .get();
  if (snap.length) {
    return <Token>snap[0];
  }
  snap = await soonDb()
    .collection(COL.TOKEN)
    .where('space', '==', space)
    .where('public', '==', true)
    .limit(1)
    .get();
  return <Token | undefined>snap[0];
};

export const getUnclaimedDrops = async (token: string, member: string) =>
  soonDb()
    .collection(COL.AIRDROP)
    .where('token', '==', token)
    .where('member', '==', member)
    .where('status', '==', TokenDropStatus.UNCLAIMED)
    .get<TokenDrop>();

export const getUnclaimedAirdropTotalValue = async (token: string) => {
  let count = 0;
  let lastDocId = '';
  do {
    const lastDoc = await getSnapshot(COL.AIRDROP, lastDocId);
    const snap = await soonDb()
      .collection(COL.AIRDROP)
      .where('token', '==', token)
      .where('status', '==', TokenDropStatus.UNCLAIMED)
      .startAfter(lastDoc)
      .get<TokenDrop>();
    lastDocId = last(snap)?.uid || '';

    count += snap.reduce((acc, act) => acc + act.count, 0);
  } while (lastDocId);
  return count;
};

export const getTokenBySymbol = async (symbol: string) => {
  let snap = await soonDb()
    .collection(COL.TOKEN)
    .where('symbol', '==', symbol.toUpperCase())
    .where('approved', '==', true)
    .limit(1)
    .get();
  if (snap.length) {
    return <Token>snap[0];
  }
  snap = await soonDb()
    .collection(COL.TOKEN)
    .where('symbol', '==', symbol.toUpperCase())
    .where('public', '==', true)
    .limit(1)
    .get();
  return <Token | undefined>snap[0];
};

export const getTokenByMintId = async (tokenId: string) => {
  const snap = await soonDb()
    .collection(COL.TOKEN)
    .where('mintingData.tokenId', '==', tokenId)
    .get();
  return <Token | undefined>snap[0];
};
