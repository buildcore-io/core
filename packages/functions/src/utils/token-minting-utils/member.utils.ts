import { INodeInfo } from '@iota/iota.js-next';
import { HexHelper } from '@iota/util.js-next';
import { COL, SUB_COL, Token, TokenDistribution, TokenDrop } from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import { last } from 'lodash';
import admin from '../../admin.config';
import { packBasicOutput } from '../basic-output.utils';
import { LastDocType } from '../common.utils';

export const getOwnedTokenTotal = async (token: string) => {
  let count = 0;
  let lastDoc: LastDocType | undefined = undefined;
  do {
    let query = admin
      .firestore()
      .collection(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}`)
      .limit(1000);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    count += snap.docs.reduce(
      (acc, act) => acc + ((<TokenDistribution>act.data()).tokenOwned || 0),
      0,
    );
  } while (lastDoc);
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
