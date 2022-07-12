import { buyToken, cancelBuyOrSell } from "../src/controls/token-sale/token-buy.controller";
import { sellToken } from "../src/controls/token-sale/token-sell.controller";
import { WEN_FUNC } from './../interfaces/functions/index';
import { addOwner, approveAward, approveParticipant, createAward, participate, rejectAward } from './controls/award.control';
import { approveCollection, createCollection, rejectCollection, updateCollection } from './controls/collection.control';
import { createMember, updateMember } from './controls/member.control';
import { createBatchNft, createNft, setForSaleNft } from './controls/nft.control';
import { openBid, orderNft, validateAddress } from './controls/order.control';
import { approveProposal, createProposal, rejectProposal, voteOnProposal } from './controls/proposal.control';
import { acceptMemberSpace, addGuardian, blockMember, createSpace, declineMemberSpace, joinSpace, leaveSpace, removeGuardian, setAlliance, unblockMember, updateSpace } from './controls/space.control';
import { claimMintedTokenOrder, mintTokenOrder } from './controls/token-mint.controller';
import { sellMintedTokenOrder } from './controls/token-sale/minted-token-sell.controller';
import { airdropToken, cancelPublicSale, claimAirdroppedToken, createToken, creditToken, orderToken, setTokenAvailableForSale, updateToken } from './controls/token.control';
import { cron } from './cron';
import { collectionWrite } from './triggers/collection.trigger';
import { atoiMilestoneTransactionWrite, iotaMilestoneTransactionWrite } from './triggers/milestone-transactions-triggers/iota-milestone-transaction.trigger';
import { rmsMilestoneTransactionWrite, smrMilestoneTransactionWrite } from './triggers/milestone-transactions-triggers/smr-milestone-transaction.trigger';
import { nftWrite } from './triggers/nft.trigger';
import { onTokenBuySellWrite } from './triggers/token-buy-sell/token-buy-sell.trigger';
import { onTokenPurchaseCreated } from './triggers/token-buy-sell/token-purchase.trigger';
import { onTokenStatusUpdate } from './triggers/token.trigger';
import { transactionWrite } from './triggers/transaction.trigger';
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
exports[WEN_FUNC.setAlliance] = setAlliance;

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

// Collection functions
exports[WEN_FUNC.cCollection] = createCollection;
exports[WEN_FUNC.uCollection] = updateCollection;
exports[WEN_FUNC.approveCollection] = approveCollection;
exports[WEN_FUNC.rejectCollection] = rejectCollection;

// NFT Functions
exports[WEN_FUNC.cNft] = createNft;
exports[WEN_FUNC.setForSaleNft] = setForSaleNft;
exports[WEN_FUNC.cBatchNft] = createBatchNft;

// Order functions
exports[WEN_FUNC.orderNft] = orderNft;
exports[WEN_FUNC.openBid] = openBid;
exports[WEN_FUNC.validateAddress] = validateAddress;

// CRON Tasks
export { cron };
export { milestoneTriggers as trigger };
// TRIGGER Tasks
const prodMilestoneTriggers = {
  iotaMilestoneTransactionWrite,
  smrMilestoneTransactionWrite
}
const testMilestoneTriggers = {
  atoiMilestoneTransactionWrite,
  rmsMilestoneTransactionWrite
}
const milestoneTriggers = isProdEnv() ? prodMilestoneTriggers : { ...prodMilestoneTriggers, ...testMilestoneTriggers }

exports['trigger_transactionWrite'] = transactionWrite;
exports['trigger_collectionWrite'] = collectionWrite;
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
exports['trigger_onTokenBuySellWrite'] = onTokenBuySellWrite;
exports['trigger_onTokenPurchaseCreated'] = onTokenPurchaseCreated;
exports[WEN_FUNC.cancelBuyOrSell] = cancelBuyOrSell;
exports[WEN_FUNC.sellToken] = sellToken;
exports[WEN_FUNC.buyToken] = buyToken;
exports[WEN_FUNC.cancelPublicSale] = cancelPublicSale;
exports[WEN_FUNC.mintTokenOrder] = mintTokenOrder;
exports[WEN_FUNC.claimMintedTokenOrder] = claimMintedTokenOrder;
exports[WEN_FUNC.sellMintedToken] = sellMintedTokenOrder
