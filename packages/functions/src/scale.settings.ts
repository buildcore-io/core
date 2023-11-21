import { COL, WEN_FUNC } from '@build-5/interfaces';
import {
  RuntimeOptions,
  WEN_FUNC_TRIGGER,
  WEN_SCHEDULED,
  WEN_STORAGE_TRIGGER,
} from './runtime/common';
import { getBucket, isProdEnv } from './utils/config.utils';
export const lowCold = 0;
export const lowWarm = isProdEnv() ? 1 : lowCold;
export const highUse = isProdEnv() ? 3 : lowWarm;

export const WEN_FUNC_SCALE: { [key: string]: RuntimeOptions } = {
  // Min MEMORY / CPU instance, so high use works well here.
  [WEN_FUNC.createMember]: { minInstances: highUse },
  [WEN_FUNC.updateMember]: { minInstances: lowWarm },

  // Space functions
  [WEN_FUNC.createSpace]: { minInstances: lowCold },
  [WEN_FUNC.updateSpace]: { minInstances: lowCold },
  [WEN_FUNC.joinSpace]: { minInstances: lowWarm },
  [WEN_FUNC.leaveSpace]: { minInstances: lowCold },
  [WEN_FUNC.addGuardianSpace]: { minInstances: lowCold },
  [WEN_FUNC.removeGuardianSpace]: { minInstances: lowCold },
  [WEN_FUNC.blockMemberSpace]: { minInstances: lowCold },
  [WEN_FUNC.unblockMemberSpace]: { minInstances: lowCold },
  [WEN_FUNC.acceptMemberSpace]: { minInstances: lowCold },
  [WEN_FUNC.declineMemberSpace]: { minInstances: lowCold },

  // Award Functions
  [WEN_FUNC.createAward]: { minInstances: lowCold },
  [WEN_FUNC.addOwnerAward]: { minInstances: lowCold },
  [WEN_FUNC.participateAward]: { minInstances: lowWarm },
  [WEN_FUNC.approveParticipantAward]: {
    minInstances: lowCold,
    timeoutSeconds: 540,
    memory: '4GiB',
  },

  // Proposal Functions
  [WEN_FUNC.createProposal]: { minInstances: lowCold, timeoutSeconds: 300, memory: '2GiB' },
  [WEN_FUNC.approveProposal]: { minInstances: lowCold },
  [WEN_FUNC.rejectProposal]: { minInstances: lowCold },
  [WEN_FUNC.voteOnProposal]: { minInstances: lowCold },

  // Collections
  [WEN_FUNC.createCollection]: { minInstances: lowCold },
  [WEN_FUNC.updateCollection]: { minInstances: lowWarm },
  [WEN_FUNC.rejectCollection]: { minInstances: lowCold },

  [WEN_FUNC.createNft]: { minInstances: lowCold },
  [WEN_FUNC.setForSaleNft]: { minInstances: lowWarm },
  [WEN_FUNC.createBatchNft]: { minInstances: lowCold, timeoutSeconds: 300, memory: '4GiB' },
  [WEN_FUNC.updateUnsoldNft]: { minInstances: lowCold },

  // Min MEMORY / CPU instance, so high use works well here.
  [WEN_FUNC.orderNft]: { minInstances: highUse },
  [WEN_FUNC.validateAddress]: { minInstances: lowWarm },

  [WEN_FUNC.createToken]: { minInstances: lowCold },

  // Min MEMORY / CPU instance, so high use works well here.
  [WEN_FUNC.mintCollection]: { minInstances: lowCold, memory: '8GiB', timeoutSeconds: 540, cpu: 2 },

  [WEN_FUNC.uploadFile]: { memory: '512MiB' },
};

export const ALGOLIA_TRIGGER_SCALE: { [key: string]: RuntimeOptions } = {
  [COL.SPACE]: { minInstances: lowWarm, memory: '256MiB' },
  [COL.TOKEN]: { minInstances: lowWarm, memory: '256MiB' },
  [COL.AWARD]: { minInstances: lowWarm, memory: '256MiB' },
  [COL.NFT]: { minInstances: lowWarm, memory: '512MiB', cpu: 1, concurrency: 100 },
  [COL.COLLECTION]: { minInstances: lowWarm, memory: '512MiB', cpu: 1, concurrency: 300 },
  [COL.MEMBER]: { minInstances: lowWarm, memory: '256MiB' },
  [COL.PROPOSAL]: { minInstances: lowWarm, memory: '256MiB' },
};

export const TRIGGER_SCALE: { [key: string]: RuntimeOptions } = {
  [WEN_FUNC_TRIGGER.onMilestoneTransactionWrite]: { minInstances: highUse },
  [WEN_FUNC_TRIGGER.onAwardUpdated]: { concurrency: 1000 },
  [WEN_FUNC_TRIGGER.onCollectionUpdated]: {
    timeoutSeconds: 540,
    minInstances: lowWarm,
    memory: isProdEnv() ? '1GiB' : undefined,
  },
  [WEN_FUNC_TRIGGER.onTokenStatusUpdated]: {
    timeoutSeconds: 540,
    memory: '4GiB',
    minInstances: lowWarm,
  },
  [WEN_FUNC_TRIGGER.onTokenTradeOrderWrite]: { timeoutSeconds: 540, minInstances: highUse },
  [WEN_FUNC_TRIGGER.onTokenPurchaseCreated]: { minInstances: lowWarm, concurrency: 1000 },
  [WEN_FUNC_TRIGGER.onNftWrite]: {
    minInstances: lowWarm,
    timeoutSeconds: 540,
    memory: '2GiB',
    concurrency: 40,
  },
  [WEN_FUNC_TRIGGER.onTransactionWrite]: {
    timeoutSeconds: 540,
    minInstances: lowWarm,
    memory: '4GiB',
  },
  [WEN_FUNC_TRIGGER.onMnemonicUpdated]: { minInstances: lowWarm, concurrency: 500 },
  [WEN_FUNC_TRIGGER.onCollectionStatsWrite]: { concurrency: 1000 },
};

export const STORAGE_TRIGGER_SCALE: { [key: string]: RuntimeOptions } = {
  [WEN_STORAGE_TRIGGER.onUploadFinalized]: {
    memory: '4GiB',
    minInstances: lowWarm,
    bucket: getBucket(),
  },
};

export const CRON_TRIGGER_SCALE: { [key: string]: RuntimeOptions } = {
  [WEN_SCHEDULED.onStakeRewardExpired]: { timeoutSeconds: 540, memory: '1GiB' },
  [WEN_SCHEDULED.mediaUpload]: { memory: '4GiB' },
  [WEN_SCHEDULED.updateFloorPriceOnCollections]: { timeoutSeconds: 1800 },
};
