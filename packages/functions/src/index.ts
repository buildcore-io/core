import { WEN_FUNC, WEN_FUNC_TRIGGER } from '@build-5/interfaces';
import { algoliaTrigger } from './algolia/algolia.trigger';
import { validateAddress } from './runtime/firebase/address';
import { generateCustomToken } from './runtime/firebase/auth';
import {
  addOwnerAward,
  approveAwardParticipant,
  awardParticipate,
  cancelAward,
  createAward,
  fundAward,
  rejectAward,
} from './runtime/firebase/award/index';
import {
  approveCollection,
  createCollection,
  mintCollection,
  rejectCollection,
  updateCollection,
} from './runtime/firebase/collection';
import { creditUnrefundable } from './runtime/firebase/credit/index';
import { createMember, updateMember } from './runtime/firebase/member';
import {
  createBatchNft,
  createNft,
  depositNft,
  openBid,
  orderNft,
  setForSaleNft,
  stakeNft,
  updateUnsoldNft,
  withdrawNft,
} from './runtime/firebase/nft/index';
import {
  approveProposal,
  createProposal,
  rejectProposal,
  voteOnProposal,
} from './runtime/firebase/proposal';
import { rankController } from './runtime/firebase/rank';
import {
  acceptMemberSpace,
  addGuardian,
  blockMember,
  claimSpace,
  createSpace,
  declineMemberSpace,
  joinSpace,
  leaveSpace,
  removeGuardian,
  unblockMember,
  updateSpace,
} from './runtime/firebase/space';
import { depositStake, removeStakeReward, stakeReward } from './runtime/firebase/stake';
import {
  airdropToken,
  cancelPublicSale,
  claimAirdroppedToken,
  createToken,
  creditToken,
  enableTokenTrading,
  orderToken,
  setTokenAvailableForSale,
  updateToken,
} from './runtime/firebase/token/base';
import {
  airdropMintedToken,
  claimMintedTokenOrder,
  importMintedToken,
  mintTokenOrder,
} from './runtime/firebase/token/minting';
import { cancelTradeOrder, tradeToken } from './runtime/firebase/token/trading';
import { voteController } from './runtime/firebase/vote';
import { awardUpdateTrigger } from './triggers/award.trigger';
import { collectionStatsUpdate } from './triggers/collection.stats.trigger';
import { collectionWrite } from './triggers/collection.trigger';
import {
  atoiMilestoneTransactionWrite,
  iotaMilestoneTransactionWrite,
} from './triggers/milestone-transactions-triggers/iota-milestone-transaction.trigger';
import {
  rmsMilestoneTransactionWrite,
  smrMilestoneTransactionWrite,
} from './triggers/milestone-transactions-triggers/smr-milestone-transaction.trigger';
import { mnemonicWrite } from './triggers/mnemonic.trigger';
import { nftWrite } from './triggers/nft.trigger';
import { onProposalUpdated } from './triggers/proposal.trigger';
import { resizeImageTrigger } from './triggers/storage/resize.img.trigger';
import { onTokenPurchaseCreated } from './triggers/token-trading/token-purchase.trigger';
import { onTokenTradeOrderWrite } from './triggers/token-trading/token-trade-order.trigger';
import { onTokenStatusUpdate } from './triggers/token.trigger';
import { transactionWrite } from './triggers/transaction-trigger/transaction.trigger';
import { isProdEnv } from './utils/config.utils';
import { uploadFile } from './runtime/firebase/storage/file.upload';

// Members functions.
exports[WEN_FUNC.createMember] = createMember;
exports[WEN_FUNC.updateMember] = updateMember;

// Space functions.
exports[WEN_FUNC.createSpace] = createSpace;
exports[WEN_FUNC.updateSpace] = updateSpace;
exports[WEN_FUNC.joinSpace] = joinSpace;
exports[WEN_FUNC.leaveSpace] = leaveSpace;
exports[WEN_FUNC.addGuardianSpace] = addGuardian;
exports[WEN_FUNC.removeGuardianSpace] = removeGuardian;
exports[WEN_FUNC.blockMemberSpace] = blockMember;
exports[WEN_FUNC.unblockMemberSpace] = unblockMember;
exports[WEN_FUNC.acceptMemberSpace] = acceptMemberSpace;
exports[WEN_FUNC.declineMemberSpace] = declineMemberSpace;

// Award Functions
exports[WEN_FUNC.createAward] = createAward;
exports[WEN_FUNC.fundAward] = fundAward;
exports[WEN_FUNC.rejectAward] = rejectAward;
exports[WEN_FUNC.addOwnerAward] = addOwnerAward;
exports[WEN_FUNC.participateAward] = awardParticipate;
exports[WEN_FUNC.approveParticipantAward] = approveAwardParticipant;
exports[WEN_FUNC_TRIGGER.awardTrigger] = awardUpdateTrigger;
exports[WEN_FUNC.cancelAward] = cancelAward;

// Award Functions
exports[WEN_FUNC.createProposal] = createProposal;
exports[WEN_FUNC.approveProposal] = approveProposal;
exports[WEN_FUNC.rejectProposal] = rejectProposal;
exports[WEN_FUNC.voteOnProposal] = voteOnProposal;
exports['trigger_' + WEN_FUNC_TRIGGER.onProposalUpdated] = onProposalUpdated;

// Collection functions
exports[WEN_FUNC.createCollection] = createCollection;
exports[WEN_FUNC.updateCollection] = updateCollection;
exports[WEN_FUNC.approveCollection] = approveCollection;
exports[WEN_FUNC.rejectCollection] = rejectCollection;

// Order functions
exports[WEN_FUNC.openBid] = openBid;
exports[WEN_FUNC.validateAddress] = validateAddress;

export * from './cron';
export { algoliaTrigger, milestoneTriggers as trigger };

exports[WEN_FUNC.creditUnrefundable] = creditUnrefundable;
exports[WEN_FUNC.mintCollection] = mintCollection;

exports[WEN_FUNC.createNft] = createNft;
exports[WEN_FUNC.createBatchNft] = createBatchNft;
exports[WEN_FUNC.updateUnsoldNft] = updateUnsoldNft;
exports[WEN_FUNC.setForSaleNft] = setForSaleNft;
exports[WEN_FUNC.withdrawNft] = withdrawNft;
exports[WEN_FUNC.depositNft] = depositNft;
exports[WEN_FUNC.orderNft] = orderNft;
exports[WEN_FUNC.stakeNft] = stakeNft;

// TRIGGER Tasks
const prodMilestoneTriggers = {
  iotaMilestoneTransactionWrite,
  smrMilestoneTransactionWrite,
};
const testMilestoneTriggers = {
  atoiMilestoneTransactionWrite,
  rmsMilestoneTransactionWrite,
};
const milestoneTriggers = isProdEnv()
  ? prodMilestoneTriggers
  : { ...prodMilestoneTriggers, ...testMilestoneTriggers };

exports['trigger_transactionWrite'] = transactionWrite;
exports['trigger_collectionWrite'] = collectionWrite;
exports['trigger_collectionStatsUpdate'] = collectionStatsUpdate;
exports['trigger_nftWrite'] = nftWrite;

// Token functions
exports[WEN_FUNC.createToken] = createToken;
exports[WEN_FUNC.updateToken] = updateToken;
exports[WEN_FUNC.setTokenAvailableForSale] = setTokenAvailableForSale;
exports[WEN_FUNC.orderToken] = orderToken;
exports[WEN_FUNC.creditToken] = creditToken;
exports[WEN_FUNC.airdropToken] = airdropToken;
exports[WEN_FUNC.claimAirdroppedToken] = claimAirdroppedToken;
exports['trigger_onTokenStatusUpdate'] = onTokenStatusUpdate;
exports['trigger_onTokenTradeOrderWrite'] = onTokenTradeOrderWrite;
exports['trigger_onTokenPurchaseCreated'] = onTokenPurchaseCreated;
exports[WEN_FUNC.cancelTradeOrder] = cancelTradeOrder;
exports[WEN_FUNC.tradeToken] = tradeToken;
exports[WEN_FUNC.cancelPublicSale] = cancelPublicSale;
exports[WEN_FUNC.mintTokenOrder] = mintTokenOrder;
exports[WEN_FUNC.claimMintedTokenOrder] = claimMintedTokenOrder;
exports['trigger_' + WEN_FUNC_TRIGGER.mnemonicWrite] = mnemonicWrite;
exports[WEN_FUNC.depositStake] = depositStake;
exports[WEN_FUNC.airdropMintedToken] = airdropMintedToken;
exports[WEN_FUNC.voteController] = voteController;
exports[WEN_FUNC.rankController] = rankController;
exports[WEN_FUNC.enableTokenTrading] = enableTokenTrading;

exports['storage_trigger_resizeImage'] = resizeImageTrigger;

exports[WEN_FUNC.stakeReward] = stakeReward;
exports[WEN_FUNC.removeStakeReward] = removeStakeReward;

exports[WEN_FUNC.generateCustomToken] = generateCustomToken;

exports[WEN_FUNC.claimSpace] = claimSpace;

exports[WEN_FUNC.importMintedToken] = importMintedToken;

exports[WEN_FUNC.uploadFile] = uploadFile;
