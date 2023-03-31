import { COL, WEN_FUNC } from '@soonaverse/interfaces';
import { isProdEnv, isProdOrTestEnv } from './utils/config.utils';
export const lowCold = 0;
export const lowWarm = isProdEnv() ? 1 : lowCold;
export const medium = isProdEnv() ? 3 : 1;
export const important = isProdEnv() ? 6 : 1;
export const pump = isProdEnv() ? 9 : 1;
export const superPump = isProdEnv() ? 20 : 1;

export function scale(func: WEN_FUNC): number {
  const scaleSettings = {} as { [key: string]: number };
  scaleSettings[WEN_FUNC.cMemberNotExists] = important;
  scaleSettings[WEN_FUNC.uMember] = lowWarm;

  // Space functions.
  scaleSettings[WEN_FUNC.cSpace] = lowCold;
  scaleSettings[WEN_FUNC.uSpace] = lowWarm;
  scaleSettings[WEN_FUNC.joinSpace] = medium;
  scaleSettings[WEN_FUNC.leaveSpace] = lowCold;
  scaleSettings[WEN_FUNC.addGuardianSpace] = lowCold;
  scaleSettings[WEN_FUNC.removeGuardianSpace] = lowCold;
  scaleSettings[WEN_FUNC.blockMemberSpace] = lowCold;
  scaleSettings[WEN_FUNC.unblockMemberSpace] = lowCold;
  scaleSettings[WEN_FUNC.acceptMemberSpace] = lowCold;
  scaleSettings[WEN_FUNC.declineMemberSpace] = lowCold;

  // Award Functions
  scaleSettings[WEN_FUNC.cAward] = lowCold;
  scaleSettings[WEN_FUNC.addOwnerAward] = lowCold;
  scaleSettings[WEN_FUNC.participateAward] = lowWarm;
  scaleSettings[WEN_FUNC.aParticipantAward] = lowWarm;

  // Proposal Functions
  scaleSettings[WEN_FUNC.cProposal] = lowCold;
  scaleSettings[WEN_FUNC.aProposal] = lowCold;
  scaleSettings[WEN_FUNC.rProposal] = lowCold;
  scaleSettings[WEN_FUNC.voteOnProposal] = lowCold;

  // Collections
  scaleSettings[WEN_FUNC.cCollection] = lowCold;
  scaleSettings[WEN_FUNC.uCollection] = lowWarm;
  scaleSettings[WEN_FUNC.approveCollection] = lowCold;
  scaleSettings[WEN_FUNC.rejectCollection] = lowCold;
  scaleSettings[WEN_FUNC.collectionWrite] = medium;

  scaleSettings[WEN_FUNC.cNft] = lowCold;
  scaleSettings[WEN_FUNC.setForSaleNft] = lowWarm;
  scaleSettings[WEN_FUNC.cBatchNft] = lowCold;
  scaleSettings[WEN_FUNC.updateUnsoldNft] = lowCold;

  scaleSettings[WEN_FUNC.orderNft] = important;
  scaleSettings[WEN_FUNC.validateAddress] = medium;

  scaleSettings[WEN_FUNC.cToken] = lowCold;
  scaleSettings[WEN_FUNC.onTokenStatusUpdate] = important;
  scaleSettings[WEN_FUNC.onTokenTradeOrderWrite] = important;
  scaleSettings[WEN_FUNC.onTokenPurchaseCreated] = important;

  scaleSettings[WEN_FUNC.milestoneTransactionWrite] = superPump; // 20
  scaleSettings[WEN_FUNC.nftWrite] = pump;
  scaleSettings[WEN_FUNC.transactionWrite] = superPump;
  scaleSettings[WEN_FUNC.mnemonicWrite] = superPump;
  scaleSettings[WEN_FUNC.mintCollection] = lowCold;

  scaleSettings[WEN_FUNC.algolia] = important;
  scaleSettings[WEN_FUNC.resizeImg] = pump;

  return isProdOrTestEnv() ? scaleSettings[func] || lowCold : 0;
}

export function scaleAlgolia(col: COL): number {
  const scaleSettings = {} as { [key: string]: number };
  scaleSettings[COL.SPACE] = lowWarm;
  scaleSettings[COL.TOKEN] = lowWarm;
  scaleSettings[COL.AWARD] = lowWarm;
  scaleSettings[COL.NFT] = medium;
  scaleSettings[COL.COLLECTION] = important;
  scaleSettings[COL.MEMBER] = medium;
  scaleSettings[COL.PROPOSAL] = lowWarm;

  return isProdOrTestEnv() ? scaleSettings[col] || lowWarm : 0;
}
