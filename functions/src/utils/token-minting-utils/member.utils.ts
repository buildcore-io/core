import { INodeInfo } from "@iota/iota.js-next";
import { HexHelper } from "@iota/util.js-next";
import bigInt from "big-integer";
import dayjs from "dayjs";
import { Token, TokenDistribution, TokenDrop } from "../../../interfaces/models";
import { COL, SUB_COL } from "../../../interfaces/models/base";
import admin from "../../admin.config";
import { packBasicOutput } from "../basic-output.utils";
import { dateToTimestamp } from "../dateTime.utils";
import { getRandomEthAddress } from "../wallet.utils";

export const distributionToDrops = (distribution: TokenDistribution | undefined) => {
  const tokenOwned = distribution?.mintedClaimedOn ? 0 : (distribution?.tokenOwned || 0)
  const drops = distribution?.tokenDrops || []
  if (tokenOwned) {
    drops.push({ uid: getRandomEthAddress(), count: tokenOwned, vestingAt: dateToTimestamp(dayjs()) })
  }
  return drops
}

export const getTotalDistributedTokenCount = async (token: Token) => {
  const snap = await admin.firestore().collection(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}`).get()
  const distributions = snap.docs.map(d => <TokenDistribution>d.data())
  const drops = distributions.reduce((acc, act) => [...acc, ...distributionToDrops(act)], [] as TokenDrop[])
  return drops.reduce((acc, act) => acc + act.count, 0)
}

export const dropToOutput = (token: Token, drop: TokenDrop, targetAddress: string, info: INodeInfo) => {
  const nativeTokens = [{ amount: HexHelper.fromBigInt256(bigInt(drop.count)), id: token.mintingData?.tokenId! }]
  const vestingAt = dayjs(drop.vestingAt.toDate()).isAfter(dayjs()) ? drop.vestingAt : undefined
  return packBasicOutput(targetAddress, 0, nativeTokens, info, undefined, vestingAt)
}
