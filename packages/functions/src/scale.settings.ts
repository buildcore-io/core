import { COL, WEN_FUNC, WEN_FUNC_TRIGGER } from '@build5/interfaces';
import { isProdEnv } from './utils/config.utils';
export const lowCold = 0;
export const lowWarm = isProdEnv() ? 1 : lowCold;
export const medium = isProdEnv() ? 3 : 1;
export const important = isProdEnv() ? 6 : 1;
export const pump = isProdEnv() ? 9 : 1;
export const superPump = isProdEnv() ? 20 : 1;

export function scale(func: WEN_FUNC | WEN_FUNC_TRIGGER): number {
  const scaleSettings = {} as { [key: string]: number };
  scaleSettings[WEN_FUNC.createMember] = important;
  scaleSettings[WEN_FUNC.updateMember] = lowWarm;

  // Space functions.
  scaleSettings[WEN_FUNC.createSpace] = lowCold;
  scaleSettings[WEN_FUNC.updateSpace] = lowWarm;
  scaleSettings[WEN_FUNC.joinSpace] = medium;
  scaleSettings[WEN_FUNC.leaveSpace] = lowCold;
  scaleSettings[WEN_FUNC.addGuardianSpace] = lowCold;
  scaleSettings[WEN_FUNC.removeGuardianSpace] = lowCold;
  scaleSettings[WEN_FUNC.blockMemberSpace] = lowCold;
  scaleSettings[WEN_FUNC.unblockMemberSpace] = lowCold;
  scaleSettings[WEN_FUNC.acceptMemberSpace] = lowCold;
  scaleSettings[WEN_FUNC.declineMemberSpace] = lowCold;

  // Award Functions
  scaleSettings[WEN_FUNC.createAward] = lowCold;
  scaleSettings[WEN_FUNC.addOwnerAward] = lowCold;
  scaleSettings[WEN_FUNC.participateAward] = lowWarm;
  scaleSettings[WEN_FUNC.approveParticipantAward] = lowWarm;

  // Proposal Functions
  scaleSettings[WEN_FUNC.createProposal] = lowCold;
  scaleSettings[WEN_FUNC.approveProposal] = lowCold;
  scaleSettings[WEN_FUNC.rejectProposal] = lowCold;
  scaleSettings[WEN_FUNC.voteOnProposal] = lowCold;

  // Collections
  scaleSettings[WEN_FUNC.createCollection] = lowCold;
  scaleSettings[WEN_FUNC.updateCollection] = lowWarm;
  scaleSettings[WEN_FUNC.approveCollection] = lowCold;
  scaleSettings[WEN_FUNC.rejectCollection] = lowCold;
  scaleSettings[WEN_FUNC_TRIGGER.collectionWrite] = lowWarm;

  scaleSettings[WEN_FUNC.createNft] = lowCold;
  scaleSettings[WEN_FUNC.setForSaleNft] = lowWarm;
  scaleSettings[WEN_FUNC.createBatchNft] = lowCold;
  scaleSettings[WEN_FUNC.updateUnsoldNft] = lowCold;

  scaleSettings[WEN_FUNC.orderNft] = important;
  scaleSettings[WEN_FUNC.validateAddress] = medium;

  scaleSettings[WEN_FUNC.createToken] = lowCold;
  scaleSettings[WEN_FUNC_TRIGGER.onTokenStatusUpdate] = medium;
  scaleSettings[WEN_FUNC_TRIGGER.onTokenTradeOrderWrite] = medium;
  scaleSettings[WEN_FUNC_TRIGGER.onTokenPurchaseCreated] = medium;

  scaleSettings[WEN_FUNC_TRIGGER.milestoneTransactionWrite] = important;
  scaleSettings[WEN_FUNC_TRIGGER.nftWrite] = important;
  scaleSettings[WEN_FUNC_TRIGGER.transactionWrite] = superPump;
  scaleSettings[WEN_FUNC_TRIGGER.mnemonicWrite] = pump;
  scaleSettings[WEN_FUNC.mintCollection] = lowCold;

  scaleSettings[WEN_FUNC_TRIGGER.algolia] = important;
  scaleSettings[WEN_FUNC_TRIGGER.resizeImg] = pump;

  return isProdEnv() ? scaleSettings[func] || lowCold : 0;
}

export function scaleAlgolia(col: COL): number {
  const scaleSettings = {} as { [key: string]: number };
  scaleSettings[COL.SPACE] = lowWarm;
  scaleSettings[COL.TOKEN] = lowWarm;
  scaleSettings[COL.AWARD] = lowWarm;
  scaleSettings[COL.NFT] = medium;
  scaleSettings[COL.COLLECTION] = medium;
  scaleSettings[COL.MEMBER] = medium;
  scaleSettings[COL.PROPOSAL] = lowWarm;

  return isProdEnv() ? scaleSettings[col] || lowWarm : 0;
}
