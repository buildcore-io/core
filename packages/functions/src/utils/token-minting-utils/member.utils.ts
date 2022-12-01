import { INodeInfo } from '@iota/iota.js-next';
import { HexHelper } from '@iota/util.js-next';
import { COL, SUB_COL, Token, TokenDistribution, TokenDrop } from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import { last } from 'lodash';
import admin from '../../admin.config';
import { packBasicOutput } from '../basic-output.utils';
import { LastDocType } from '../common.utils';
import { dateToTimestamp } from '../dateTime.utils';
import { getRandomEthAddress } from '../wallet.utils';

export const distributionToDrops = (distribution: TokenDistribution | undefined) => {
  const tokenOwned = distribution?.mintedClaimedOn ? 0 : distribution?.tokenOwned || 0;
  const drops = [...(distribution?.tokenDrops || [])];
  if (tokenOwned) {
    drops.push({
      uid: getRandomEthAddress(),
      count: tokenOwned,
      vestingAt: dateToTimestamp(dayjs()),
      createdOn: dateToTimestamp(dayjs()),
    });
  }
  return drops;
};

const BATCH_SIZE = 1000;
export const getTotalDistributedTokenCount = async (token: Token) => {
  let count = 0;
  let lastDoc: LastDocType | undefined = undefined;
  do {
    let query = admin
      .firestore()
      .collection(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}`)
      .limit(BATCH_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    count += snap.docs.reduce((acc, act) => {
      const dropsTotalCount = distributionToDrops(<TokenDistribution>act.data()).reduce(
        (sum, drop) => sum + drop.count,
        0,
      );
      return acc + dropsTotalCount;
    }, 0);
    lastDoc = last(snap.docs);
  } while (lastDoc !== undefined);
  return count;
};

export const dropToOutput = (
  token: Token,
  drop: TokenDrop,
  targetAddress: string,
  info: INodeInfo,
) => {
  const nativeTokens = [
    { amount: HexHelper.fromBigInt256(bigInt(drop.count)), id: token.mintingData?.tokenId! },
  ];
  const vestingAt = dayjs(drop.vestingAt.toDate()).isAfter(dayjs()) ? drop.vestingAt : undefined;
  return packBasicOutput(targetAddress, 0, nativeTokens, info, undefined, vestingAt);
};
