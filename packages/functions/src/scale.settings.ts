import { COL, WEN_FUNC, WEN_FUNC_TRIGGER } from '@build-5/interfaces';
import { GlobalOptions } from 'firebase-functions/v2';
import { isProdEnv } from './utils/config.utils';
export const lowCold = 0;
export const lowWarm = isProdEnv() ? 1 : lowCold;
export const highUse = isProdEnv() ? 3 : lowWarm;

export function scale(func: WEN_FUNC | WEN_FUNC_TRIGGER): number {
  const scaleSettings = {} as { [key: string]: number };
  // Min MEMORY / CPU instance, so high use works well here.
  scaleSettings[WEN_FUNC.createMember] = highUse;
  scaleSettings[WEN_FUNC.updateMember] = lowWarm;

  // Space functions.
  scaleSettings[WEN_FUNC.createSpace] = lowCold;
  scaleSettings[WEN_FUNC.updateSpace] = lowCold;
  scaleSettings[WEN_FUNC.joinSpace] = lowWarm;
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
  scaleSettings[WEN_FUNC.approveParticipantAward] = lowCold;

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

  // Min MEMORY / CPU instance, so high use works well here.
  scaleSettings[WEN_FUNC.orderNft] = highUse;
  scaleSettings[WEN_FUNC.validateAddress] = lowWarm;

  scaleSettings[WEN_FUNC.createToken] = lowCold;
  scaleSettings[WEN_FUNC_TRIGGER.onTokenStatusUpdate] = lowWarm;
  // Min MEMORY / CPU instance, so high use works well here.
  scaleSettings[WEN_FUNC_TRIGGER.onTokenTradeOrderWrite] = highUse;
  scaleSettings[WEN_FUNC_TRIGGER.onTokenPurchaseCreated] = lowWarm;

  // Min MEMORY / CPU instance, so high use works well here.
  scaleSettings[WEN_FUNC_TRIGGER.milestoneTransactionWrite] = highUse;
  scaleSettings[WEN_FUNC_TRIGGER.nftWrite] = lowWarm;
  scaleSettings[WEN_FUNC_TRIGGER.transactionWrite] = lowWarm;
  scaleSettings[WEN_FUNC_TRIGGER.mnemonicWrite] = lowWarm;
  scaleSettings[WEN_FUNC.mintCollection] = lowCold;
  scaleSettings[WEN_FUNC_TRIGGER.resizeImg] = lowWarm;

  return isProdEnv() ? scaleSettings[func] || lowCold : 0;
}

export function scaleAlgolia(col: COL): GlobalOptions {
  const scaleSettings = {} as { [key: string]: GlobalOptions };
  scaleSettings[COL.SPACE] = {
    minInstances: lowWarm,
    memory: '256MiB',
  };
  scaleSettings[COL.TOKEN] = {
    minInstances: lowWarm,
    memory: '256MiB',
  };
  scaleSettings[COL.AWARD] = {
    minInstances: lowWarm,
    memory: '256MiB',
  };
  // To support concurency.
  scaleSettings[COL.NFT] = {
    minInstances: lowWarm,
    memory: '512MiB',
    cpu: 1,
    concurrency: 100,
  };
  // To support concurency.
  scaleSettings[COL.COLLECTION] = {
    minInstances: lowWarm,
    memory: '512MiB',
    cpu: 1,
    concurrency: 300,
  };
  scaleSettings[COL.MEMBER] = {
    minInstances: lowWarm,
    memory: '256MiB',
  };
  scaleSettings[COL.PROPOSAL] = {
    minInstances: lowWarm,
    memory: '256MiB',
  };

  return isProdEnv()
    ? scaleSettings[col] || {
        minInstances: lowWarm,
      }
    : { minInstances: 0 };
}
