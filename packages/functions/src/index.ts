import { WEN_FUNC } from '@soonaverse/interfaces';
import { generateCustomFirebaseToken } from './controls/auth.control';
import {
  addOwner,
  approveAward,
  approveParticipant,
  createAward,
  participate,
  rejectAward,
} from './controls/award.control';
import {
  approveCollection,
  createCollection,
  rejectCollection,
  updateCollection,
} from './controls/collection.control';
import { creditUnrefundable } from './controls/credit/credit.controller';
import { createMember, updateMember } from './controls/member.control';
import { mintCollectionOrder } from './controls/nft/collection-mint.control';
import {
  createBatchNft,
  createNft,
  depositNft,
  setForSaleNft,
  updateUnsoldNft,
  withdrawNft,
} from './controls/nft/nft.control';
import { openBid, orderNft, validateAddress } from './controls/order.control';
import {
  approveProposal,
  createProposal,
  rejectProposal,
  voteOnProposal,
} from './controls/proposal.control';
import { rankController } from './controls/rank.control';
import { addGuardian, removeGuardian } from './controls/space/guardian.add.remove.control';
import { acceptMemberSpace } from './controls/space/member.accept.control';
import { blockMember } from './controls/space/member.block.control';
import { declineMemberSpace } from './controls/space/member.decline.control';
import { joinSpace } from './controls/space/member.join.control';
import { leaveSpace } from './controls/space/member.leave.control';
import { unblockMember } from './controls/space/member.unblock.control';
import { createSpace } from './controls/space/space.create.control';
import { updateSpace } from './controls/space/space.update.control';
import { depositStake, stakeReward } from './controls/stake.control';
import { airdropToken, claimAirdroppedToken } from './controls/token-airdrop.control';
import { airdropMintedToken } from './controls/token-minting/airdrop-minted-token';
import { claimMintedTokenOrder } from './controls/token-minting/claim-minted-token.control';
import { mintTokenOrder } from './controls/token-minting/token-mint.control';
import { cancelTradeOrder } from './controls/token-trading/token-trade-cancel.controller';
import { tradeToken } from './controls/token-trading/token-trade.controller';
import {
  cancelPublicSale,
  createToken,
  creditToken,
  orderToken,
  setTokenAvailableForSale,
  updateToken,
} from './controls/token.control';
import { voteController } from './controls/vote.control';
import { cron } from './cron';
import { spaceVaultAddressDbRoller } from './dbRoll/space.vault.address';
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

// Members functions.
exports[WEN_FUNC.cMemberNotExists] = createMember;
exports[WEN_FUNC.uMember] = updateMember;

// Space functions.
exports[WEN_FUNC.cSpace] = createSpace;
exports[WEN_FUNC.uSpace] = updateSpace;
exports[WEN_FUNC.joinSpace] = joinSpace;
exports[WEN_FUNC.leaveSpace] = leaveSpace;
exports[WEN_FUNC.addGuardianSpace] = addGuardian;
exports[WEN_FUNC.removeGuardianSpace] = removeGuardian;
exports[WEN_FUNC.blockMemberSpace] = blockMember;
exports[WEN_FUNC.unblockMemberSpace] = unblockMember;
exports[WEN_FUNC.acceptMemberSpace] = acceptMemberSpace;
exports[WEN_FUNC.declineMemberSpace] = declineMemberSpace;

// Award Functions
exports[WEN_FUNC.cAward] = createAward;
exports[WEN_FUNC.aAward] = approveAward;
exports[WEN_FUNC.rAward] = rejectAward;
exports[WEN_FUNC.addOwnerAward] = addOwner;
exports[WEN_FUNC.participateAward] = participate;
exports[WEN_FUNC.aParticipantAward] = approveParticipant;

// Award Functions
exports[WEN_FUNC.cProposal] = createProposal;
exports[WEN_FUNC.aProposal] = approveProposal;
exports[WEN_FUNC.rProposal] = rejectProposal;
exports[WEN_FUNC.voteOnProposal] = voteOnProposal;
exports['trigger_' + WEN_FUNC.onProposalUpdated] = onProposalUpdated;

// Collection functions
exports[WEN_FUNC.cCollection] = createCollection;
exports[WEN_FUNC.uCollection] = updateCollection;
exports[WEN_FUNC.approveCollection] = approveCollection;
exports[WEN_FUNC.rejectCollection] = rejectCollection;

// NFT Functions
exports[WEN_FUNC.cNft] = createNft;
exports[WEN_FUNC.setForSaleNft] = setForSaleNft;
exports[WEN_FUNC.cBatchNft] = createBatchNft;
exports[WEN_FUNC.updateUnsoldNft] = updateUnsoldNft;

// Order functions
exports[WEN_FUNC.orderNft] = orderNft;
exports[WEN_FUNC.openBid] = openBid;
exports[WEN_FUNC.validateAddress] = validateAddress;

export * from './api/index';
// CRON Tasks
export { cron };
export { milestoneTriggers as trigger };

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
exports[WEN_FUNC.cToken] = createToken;
exports[WEN_FUNC.uToken] = updateToken;
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
exports['trigger_' + WEN_FUNC.mnemonicWrite] = mnemonicWrite;
exports[WEN_FUNC.mintCollection] = mintCollectionOrder;
exports[WEN_FUNC.withdrawNft] = withdrawNft;
exports[WEN_FUNC.depositNft] = depositNft;
exports[WEN_FUNC.depositStake] = depositStake;
exports[WEN_FUNC.airdropMintedToken] = airdropMintedToken;
exports[WEN_FUNC.creditUnrefundable] = creditUnrefundable;
exports[WEN_FUNC.voteController] = voteController;
exports[WEN_FUNC.rankController] = rankController;

exports['spaceVaultAddressDbRoller'] = spaceVaultAddressDbRoller;

exports['storage_trigger_resizeImage'] = resizeImageTrigger;

exports[WEN_FUNC.stakeReward] = stakeReward;

exports[WEN_FUNC.generateCustomFirebaseToken] = generateCustomFirebaseToken;
