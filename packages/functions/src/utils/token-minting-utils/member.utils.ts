import { build5Db, getSnapshot } from '@build-5/database';
import { COL, SUB_COL, Token, TokenDistribution, TokenDrop } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { last } from 'lodash';
import { Wallet } from '../../services/wallet/wallet';
import { packBasicOutput } from '../basic-output.utils';

export const getOwnedTokenTotal = async (token: string) => {
  let count = 0;
  let lastDocId = '';
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token}`);
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
  wallet: Wallet,
  token: Token,
  drop: TokenDrop,
  targetAddress: string,
) => {
  const nativeTokens = drop.isBaseToken
    ? undefined
    : [{ amount: BigInt(drop.count), id: token.mintingData?.tokenId! }];
  const vestingAt = dayjs(drop.vestingAt.toDate()).isAfter(dayjs()) ? drop.vestingAt : undefined;
  return packBasicOutput(wallet, targetAddress, 0, { nativeTokens, vestingAt });
};
