import { WEN_FUNC } from '../interfaces/functions';
import { isEmulatorEnv, isProdEnv } from './utils/config.utils';

export const low = 1;
export const medium = isProdEnv() ? 3 : 2;
export const important = isProdEnv() ? 6 : 2;
export const pump = isProdEnv() ? 9 : 2;
export const superPump = isProdEnv() ? 40 : 2;

export function scale(func: WEN_FUNC): number {
  const scaleSettings = {} as { [key: string]: number };
  scaleSettings[WEN_FUNC.cMemberNotExists] = important;
  scaleSettings[WEN_FUNC.uMember] = medium;

  // Space functions.
  scaleSettings[WEN_FUNC.cSpace] = low;
  scaleSettings[WEN_FUNC.uSpace] = low;
  scaleSettings[WEN_FUNC.joinSpace] = medium;
  scaleSettings[WEN_FUNC.leaveSpace] = low;
  scaleSettings[WEN_FUNC.addGuardianSpace] = low;
  scaleSettings[WEN_FUNC.removeGuardianSpace] = low;
  scaleSettings[WEN_FUNC.blockMemberSpace] = low;
  scaleSettings[WEN_FUNC.unblockMemberSpace] = low;
  scaleSettings[WEN_FUNC.acceptMemberSpace] = medium;
  scaleSettings[WEN_FUNC.declineMemberSpace] = low;

  // Award Functions
  scaleSettings[WEN_FUNC.cAward] = low;
  scaleSettings[WEN_FUNC.addOwnerAward] = low;
  scaleSettings[WEN_FUNC.participateAward] = medium;
  scaleSettings[WEN_FUNC.aParticipantAward] = medium;

  // Proposal Functions
  scaleSettings[WEN_FUNC.cProposal] = low;
  scaleSettings[WEN_FUNC.aProposal] = low;
  scaleSettings[WEN_FUNC.rProposal] = low;
  scaleSettings[WEN_FUNC.voteOnProposal] = medium;

  // Collections
  scaleSettings[WEN_FUNC.cCollection] = medium;
  scaleSettings[WEN_FUNC.uCollection] = medium;
  scaleSettings[WEN_FUNC.approveCollection] = low;
  scaleSettings[WEN_FUNC.rejectCollection] = low;
  scaleSettings[WEN_FUNC.collectionWrite] = medium;

  scaleSettings[WEN_FUNC.cNft] = medium;
  scaleSettings[WEN_FUNC.setForSaleNft] = medium;
  scaleSettings[WEN_FUNC.cBatchNft] = medium;
  scaleSettings[WEN_FUNC.updateUnsoldNft] = low;

  scaleSettings[WEN_FUNC.orderNft] = pump;
  scaleSettings[WEN_FUNC.validateAddress] = medium;

  scaleSettings[WEN_FUNC.cToken] = low;
  scaleSettings[WEN_FUNC.onTokenStatusUpdate] = medium;
  scaleSettings[WEN_FUNC.onTokenTradeOrderWrite] = important;
  scaleSettings[WEN_FUNC.onTokenPurchaseCreated] = important;

  scaleSettings[WEN_FUNC.milestoneTransactionWrite] = superPump;
  scaleSettings[WEN_FUNC.nftWrite] = medium;
  scaleSettings[WEN_FUNC.transactionWrite] = superPump;
  scaleSettings[WEN_FUNC.mnemonicWrite] = superPump;
  scaleSettings[WEN_FUNC.mintCollection] = pump;

  return isEmulatorEnv ? 0 : scaleSettings[func] || low;
}