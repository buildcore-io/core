import { COL, SUB_COL } from '@buildcore/interfaces';

export enum WEN_FUNC_TRIGGER {
  onProposalWrite = 'onproposalwrite',
  onAwardUpdated = 'onawardupdated',
  onCollectionUpdated = 'oncollectionupdated',
  onTokenStatusUpdated = 'ontokenstatusupdated',
  onTokenTradeOrderWrite = 'ontokentradeorderwrite',
  onTokenPurchaseCreated = 'ontokenpurchasecreated',
  onMilestoneTransactionWrite = 'onmilestonetransactionwrite',
  onNftWrite = 'onnftwrite',
  onTransactionWrite = 'ontransactionwrite',
  onMnemonicUpdated = 'onmnemonicupdated',
  onCollectionStatsWrite = 'oncollectionstatswrite',
  algolia = 'algolia',
}

export enum WEN_STORAGE_TRIGGER {
  onUploadFinalized = 'onuploadfinalized',
}

export enum WEN_SCHEDULED {
  retryWallet = 'retrywallet',
  processExpiredAwards = 'processexpiredawards',
  voidExpiredOrders = 'voidexpiredorders',
  finalizeAuctions = 'finalizeauctions',
  hidePlaceholderAfterSoldOut = 'hideplaceholderaftersoldout',
  tokenCoolDownOver = 'tokencooldownover',
  cancelExpiredSale = 'cancelexpiredsale',
  removeExpiredStakesFromSpace = 'removeexpiredstakesfromspace',
  getLatestBitfinexPrices = 'getlatestbitfinexprices',
  onStakeRewardExpired = 'onstakerewardexpired',
  mediaUpload = 'mediaupload',
  removeExpiredNftStakes = 'removeexpirednftstakes',
  updateFloorPriceOnCollections = 'updatefloorpriceoncollections',
  markExpiredProposalCompleted = 'markexpiredproposalcompleted',
  removePurchasesFromVolumeStats = 'removepurchasesfromvolumestats',
}

export interface RuntimeOptions {
  timeoutSeconds?: number;
  concurrency?: number;
  memory?: string;
  minInstances?: number;
  cpu?: number;
  region?: string;
  bucket?: string;
}

export const pathToParts = (document: string) => {
  const parts = document.split('/');
  return {
    col: parts[0] as COL,
    docId: parts[1] as string,
    subCol: parts[2] as SUB_COL,
    subDocId: parts[3] as string,
  };
};

export abstract class CloudFunctions {
  constructor(public readonly runtimeOptions: RuntimeOptions) {}
}
