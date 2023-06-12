import { COL, SUB_COL, Token, TokenDistribution, TokenDrop } from '@build-5/interfaces';
import { INodeInfo } from '@iota/iota.js-next';
import { HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import { last } from 'lodash';
import { getSnapshot, soonDb } from '../../firebase/firestore/soondb';
import { packBasicOutput } from '../basic-output.utils';

export const getOwnedTokenTotal = async (token: string) => {
  let count = 0;
  let lastDocId = '';
  const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${token}`);
  do {
    const lastDoc = lastDocId
      ? await getSnapshot(COL.TOKEN, token, SUB_COL.DISTRIBUTION, lastDocId)
      : undefined;
    const snap = await tokenDocRef
      .collection(SUB_COL.DISTRIBUTION)
      .startAfter(lastDoc)
      .limit(1000)
      .get<TokenDistribution>();
    lastDocId = last(snap)?.uid || '';

    count += snap.reduce((acc, act) => acc + (act.tokenOwned || 0), 0);
  } while (lastDocId);
  return count;
};

export const dropToOutput = (
  token: Token,
  drop: TokenDrop,
  targetAddress: string,
  info: INodeInfo,
) => {
  const amount = HexHelper.fromBigInt256(bigInt(drop.count));
  const nativeTokens = drop.isBaseToken ? undefined : [{ amount, id: token.mintingData?.tokenId! }];
  const vestingAt = dayjs(drop.vestingAt.toDate()).isAfter(dayjs()) ? drop.vestingAt : undefined;
  return packBasicOutput(targetAddress, 0, nativeTokens, info, undefined, vestingAt);
};
