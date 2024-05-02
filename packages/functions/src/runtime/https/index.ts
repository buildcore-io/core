import { NftCreateRequest, ProposalType, WEN_FUNC } from '@buildcore/interfaces';
import Joi from 'joi';
import { validateAddressSchemaObject } from '../../controls/address/AddressValidationRequestSchema';
import { validateAddressControl } from '../../controls/address/address.control';
import { auctionBidSchema } from '../../controls/auction/AuctionBidRequestSchema';
import { auctionCreateSchemaObject } from '../../controls/auction/AuctionCreateRequestSchema';
import { auctionBidControl } from '../../controls/auction/auction.control';
import { auctionCreateControl } from '../../controls/auction/auction.create.control';
import { customTokenSchema } from '../../controls/auth/CutomTokenRequestSchema';
import { generateCustomTokenControl } from '../../controls/auth/auth.control';
import { approveAwardParticipantSchemaObject } from '../../controls/award/AwardApproveParticipantRequestSchema';
import { awardCancelSchema } from '../../controls/award/AwardCancelRequestSchema';
import { awardCreateSchemaObject } from '../../controls/award/AwardCreateRequestSchema';
import { awardFundSchema } from '../../controls/award/AwardFundRequestSchema';
import { awardParticipateSchema } from '../../controls/award/AwardParticipateRequestSchema';
import { awardRejectSchema } from '../../controls/award/AwardRejectRequestSchema';
import { approveAwardParticipantControl } from '../../controls/award/award.approve.participant';
import { cancelAwardControl } from '../../controls/award/award.cancel';
import { createAwardControl } from '../../controls/award/award.create';
import { fundAwardControl } from '../../controls/award/award.fund';
import { awardParticipateControl } from '../../controls/award/award.participate';
import { rejectAwardControl } from '../../controls/award/award.reject';
import { createCollectionSchema } from '../../controls/collection/CollectionCreateRequestSchema';
import { mintCollectionSchema } from '../../controls/collection/CollectionMintRequestSchema';
import { rejectCollectionSchema } from '../../controls/collection/CollectionRejectRequestSchema';
import { mintCollectionOrderControl } from '../../controls/collection/collection-mint.control';
import { createCollectionControl } from '../../controls/collection/collection.create.control';
import { rejectCollectionControl } from '../../controls/collection/collection.reject.control';
import { updateCollectionControl } from '../../controls/collection/collection.update.control';
import { UidSchemaObject, uidSchema } from '../../controls/common';
import { creditUnrefundableSchema } from '../../controls/credit/CreditUnrefundableRequestSchema';
import { creditUnrefundableControl } from '../../controls/credit/credit.controller';
import { uploadFileControl } from '../../controls/file/file.upload.control';
import { updateMemberSchema } from '../../controls/member/UpdateMemberRequestSchema';
import { createMemberControl } from '../../controls/member/member.create';
import { updateMemberControl } from '../../controls/member/member.update';
import { nftBidSchema } from '../../controls/nft/NftBidRequestSchema';
import { createSchema, nftCreateSchema } from '../../controls/nft/NftCreateRequestSchema';
import { depositNftSchema } from '../../controls/nft/NftDepositRequestSchema';
import { metadataNftSchema } from '../../controls/nft/NftMetadataRequestSchema';
import { nftPurchaseBulkSchema } from '../../controls/nft/NftPurchaseBulkRequestSchema';
import { nftPurchaseSchema } from '../../controls/nft/NftPurchaseRequestSchema';
import { setNftForSaleSchema } from '../../controls/nft/NftSetForSaleRequestSchema';
import { stakeNftSchema } from '../../controls/nft/NftStakeRequestSchema';
import { nftTransferSchema } from '../../controls/nft/NftTransferRequestSchema';
import { updateUnsoldNftSchema } from '../../controls/nft/NftUpdateUnsoldRequestSchema';
import { nftWithdrawSchema } from '../../controls/nft/NftWithdrawRequestSchema';
import { nftBidControl } from '../../controls/nft/nft.bid.control';
import { createBatchNftControl, createNftControl } from '../../controls/nft/nft.create';
import { depositNftControl } from '../../controls/nft/nft.deposit';
import { mintMetadataNftControl } from '../../controls/nft/nft.metadata.control';
import { orderNftBulkControl } from '../../controls/nft/nft.puchase.bulk.control';
import { orderNftControl } from '../../controls/nft/nft.puchase.control';
import { setForSaleNftControl } from '../../controls/nft/nft.set.for.sale';
import { nftStakeControl } from '../../controls/nft/nft.stake';
import { transferNftsControl } from '../../controls/nft/nft.transfer';
import { updateUnsoldNftControl } from '../../controls/nft/nft.update.unsold';
import { withdrawNftControl } from '../../controls/nft/nft.withdraw';
import { projectCreateSchema } from '../../controls/project/ProjectCreateRequestSchema';
import { createProjectControl } from '../../controls/project/project.create.control';
import { deactivateProjectControl } from '../../controls/project/project.deactivate.control';
import { approveProposaSchema } from '../../controls/proposal/ProposalApproveRequestSchema';
import { proposalCreateSchemaObject } from '../../controls/proposal/ProposalCreateRequestSchema';
import { rejectProposaSchema } from '../../controls/proposal/ProposalRejectRequestSchema';
import { voteOnProposalSchemaObject } from '../../controls/proposal/ProposalVoteRequestSchema';
import { proposalApprovalControl } from '../../controls/proposal/approve.reject.proposal';
import { createProposalControl } from '../../controls/proposal/create.proposal';
import { voteOnProposalControl } from '../../controls/proposal/vote.on.proposal';
import { rankSchema } from '../../controls/rank/RankRequestSchema';
import { rankControl } from '../../controls/rank/rank.control';
import { spaceClaimSchema } from '../../controls/space/SpaceClaimRequestSchema';
import { createSpaceSchemaObject } from '../../controls/space/SpaceCreateRequestSchema';
import { editSpaceMemberSchemaObject } from '../../controls/space/SpaceEditMemberRequestSchema';
import { spaceJoinSchema } from '../../controls/space/SpaceJoinRequestSchema';
import { spaceLeaveSchema } from '../../controls/space/SpaceLeaveRequestSchema';
import { updateSpaceSchema } from '../../controls/space/SpaceUpdateRequestSchema';
import { acceptSpaceMemberControl } from '../../controls/space/member.accept.control';
import { blockMemberControl } from '../../controls/space/member.block.control';
import { declineMemberControl } from '../../controls/space/member.decline.control';
import { leaveSpaceControl } from '../../controls/space/member.leave.control';
import { unblockMemberControl } from '../../controls/space/member.unblock.control';
import { claimSpaceControl } from '../../controls/space/space.claim.control';
import { createSpaceControl } from '../../controls/space/space.create.control';
import { editGuardianControl } from '../../controls/space/space.guardian.edit.control';
import { joinSpaceControl } from '../../controls/space/space.join.control';
import { updateSpaceControl } from '../../controls/space/space.update.control';
import { removeStakeRewardSchema } from '../../controls/stake/StakeRewardRemoveRequestSchema';
import { stakeRewardsSchema } from '../../controls/stake/StakeRewardRequestSchema';
import { depositStakeSchemaObject } from '../../controls/stake/StakeTokenRequestSchema';
import { depositStakeControl } from '../../controls/stake/stake.deposit';
import { stakeRewardControl } from '../../controls/stake/stake.reward';
import { removeStakeRewardControl } from '../../controls/stake/stake.reward.revoke';
import { stampSchema } from '../../controls/stamp/StampRequestSchema';
import { stampCreateControl } from '../../controls/stamp/stamp.create';
import { swapCreateSchema } from '../../controls/swaps/SwapCreateRequestSchema';
import { swapRejectSchema } from '../../controls/swaps/SwapRejectSchema';
import { swapFundedSchema } from '../../controls/swaps/SwapSetFundedSchema';
import { swapCreateControl } from '../../controls/swaps/swap.create.control';
import { swapFundedControl } from '../../controls/swaps/swap.funded.control';
import { swapRejectControl } from '../../controls/swaps/swap.reject.control';
import { symbolSchema } from '../../controls/token-minting/TokenClaimMintedRequestSchema';
import { importMintedTokenSchema } from '../../controls/token-minting/TokenImportRequestSchema';
import { mintTokenSchema } from '../../controls/token-minting/TokenMintRequestSchema';
import { airdropMintedTokenControl } from '../../controls/token-minting/airdrop-minted-token';
import { claimMintedTokenControl } from '../../controls/token-minting/claim-minted-token.control';
import { importMintedTokenControl } from '../../controls/token-minting/import-minted-token';
import { mintTokenControl } from '../../controls/token-minting/token-mint.control';
import { cancelTradeOrderSchema } from '../../controls/token-trading/TokenCanelTradeOrderRequestSchema';
import { tradeTokenSchema } from '../../controls/token-trading/TokenTradeRequestSchema';
import { cancelTradeOrderControl } from '../../controls/token-trading/token-trade-cancel.controller';
import { tradeTokenControl } from '../../controls/token-trading/token-trade.controller';
import { airdropTokenSchema } from '../../controls/token/TokenAirdropRequestSchema';
import { cancelPubSaleSchema } from '../../controls/token/TokenCancelPubSaleRequestSchema';
import { claimAirdroppedTokenSchema } from '../../controls/token/TokenClaimAirdroppedRequestSchema';
import { createTokenSchema } from '../../controls/token/TokenCreateRequestSchema';
import { creditTokenSchema } from '../../controls/token/TokenCreditRequestSchema';
import { enableTradingSchema } from '../../controls/token/TokenEnableTradingRequestSchema';
import { orderTokenSchema } from '../../controls/token/TokenOrderRequestSchema';
import { setAvailableForSaleSchema } from '../../controls/token/TokenSetAvailableForSaleRequestSchema';
import { airdropTokenControl } from '../../controls/token/token.airdrop';
import { claimAirdroppedTokenControl } from '../../controls/token/token.airdrop.claim';
import { cancelPublicSaleControl } from '../../controls/token/token.cancel.pub.sale';
import { createTokenControl } from '../../controls/token/token.create';
import { creditTokenControl } from '../../controls/token/token.credit';
import { enableTokenTradingControl } from '../../controls/token/token.enable.trading';
import { orderTokenControl } from '../../controls/token/token.order';
import { setTokenAvailableForSaleControl } from '../../controls/token/token.set.for.sale';
import { updateTokenControl } from '../../controls/token/token.update';
import { voteSchema } from '../../controls/vote/VoteRequestSchema';
import { voteControl } from '../../controls/vote/vote.control';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { onRequest } from './https';
import { createMember, uploadFile } from './middlewares';

exports[WEN_FUNC.createMember] = onRequest({
  name: WEN_FUNC.createMember,
  schema: Joi.object({}),
  middleware: createMember,
  handler: createMemberControl,
  requireProjectApiKey: false,
});

exports[WEN_FUNC.updateMember] = onRequest({
  name: WEN_FUNC.updateMember,
  schema: updateMemberSchema,
  handler: updateMemberControl,
});

// Space functions
exports[WEN_FUNC.createSpace] = onRequest({
  name: WEN_FUNC.createSpace,
  schema: createSpaceSchemaObject,
  handler: createSpaceControl,
});

exports[WEN_FUNC.updateSpace] = onRequest({
  name: WEN_FUNC.updateSpace,
  schema: updateSpaceSchema,
  handler: updateSpaceControl,
});

exports[WEN_FUNC.joinSpace] = onRequest({
  name: WEN_FUNC.joinSpace,
  schema: spaceJoinSchema,
  handler: joinSpaceControl,
});

exports[WEN_FUNC.leaveSpace] = onRequest({
  name: WEN_FUNC.leaveSpace,
  schema: spaceLeaveSchema,
  handler: leaveSpaceControl,
});

exports[WEN_FUNC.blockMemberSpace] = onRequest({
  name: WEN_FUNC.blockMemberSpace,
  schema: editSpaceMemberSchemaObject,
  handler: blockMemberControl,
});

exports[WEN_FUNC.unblockMemberSpace] = onRequest({
  name: WEN_FUNC.unblockMemberSpace,
  schema: editSpaceMemberSchemaObject,
  handler: unblockMemberControl,
});

exports[WEN_FUNC.acceptMemberSpace] = onRequest({
  name: WEN_FUNC.acceptMemberSpace,
  schema: editSpaceMemberSchemaObject,
  handler: acceptSpaceMemberControl,
});

exports[WEN_FUNC.declineMemberSpace] = onRequest({
  name: WEN_FUNC.declineMemberSpace,
  schema: editSpaceMemberSchemaObject,
  handler: declineMemberControl,
});

exports[WEN_FUNC.addGuardianSpace] = onRequest({
  name: WEN_FUNC.addGuardianSpace,
  schema: editSpaceMemberSchemaObject,
  handler: editGuardianControl(ProposalType.ADD_GUARDIAN),
});

exports[WEN_FUNC.removeGuardianSpace] = onRequest({
  name: WEN_FUNC.removeGuardianSpace,
  schema: editSpaceMemberSchemaObject,
  handler: editGuardianControl(ProposalType.REMOVE_GUARDIAN),
});

exports[WEN_FUNC.claimSpace] = onRequest({
  name: WEN_FUNC.claimSpace,
  schema: spaceClaimSchema,
  handler: claimSpaceControl,
});

// Award functions
exports[WEN_FUNC.createAward] = onRequest({
  name: WEN_FUNC.createAward,
  schema: awardCreateSchemaObject,
  handler: createAwardControl,
});

exports[WEN_FUNC.fundAward] = onRequest({
  name: WEN_FUNC.fundAward,
  schema: awardFundSchema,
  handler: fundAwardControl,
});

exports[WEN_FUNC.rejectAward] = onRequest({
  name: WEN_FUNC.rejectAward,
  schema: awardRejectSchema,
  handler: rejectAwardControl,
});

exports[WEN_FUNC.addOwnerAward] = onRequest({
  name: WEN_FUNC.addOwnerAward,
  schema: awardCancelSchema,
  handler: cancelAwardControl,
});

exports[WEN_FUNC.participateAward] = onRequest({
  name: WEN_FUNC.participateAward,
  schema: awardParticipateSchema,
  handler: awardParticipateControl,
});

exports[WEN_FUNC.approveParticipantAward] = onRequest({
  name: WEN_FUNC.approveParticipantAward,
  schema: approveAwardParticipantSchemaObject,
  handler: approveAwardParticipantControl,
});

exports[WEN_FUNC.cancelAward] = onRequest({
  name: WEN_FUNC.cancelAward,
  schema: awardCancelSchema,
  handler: cancelAwardControl,
});

// Proposal functions
exports[WEN_FUNC.createProposal] = onRequest({
  name: WEN_FUNC.createProposal,
  schema: proposalCreateSchemaObject,
  handler: createProposalControl,
});

exports[WEN_FUNC.approveProposal] = onRequest({
  name: WEN_FUNC.approveProposal,
  schema: approveProposaSchema,
  handler: proposalApprovalControl(true),
});

exports[WEN_FUNC.rejectProposal] = onRequest({
  name: WEN_FUNC.rejectProposal,
  schema: rejectProposaSchema,
  handler: proposalApprovalControl(false),
});

exports[WEN_FUNC.voteOnProposal] = onRequest({
  name: WEN_FUNC.voteOnProposal,
  schema: voteOnProposalSchemaObject,
  handler: voteOnProposalControl,
});

// Collection functions
exports[WEN_FUNC.createCollection] = onRequest({
  name: WEN_FUNC.createCollection,
  schema: createCollectionSchema,
  handler: createCollectionControl,
});

exports[WEN_FUNC.updateCollection] = onRequest({
  name: WEN_FUNC.updateCollection,
  schema: toJoiObject<UidSchemaObject>({ uid: CommonJoi.uid() }),
  schemaOptions: { allowUnknown: true },
  handler: updateCollectionControl,
});

exports[WEN_FUNC.rejectCollection] = onRequest({
  name: WEN_FUNC.rejectCollection,
  schema: rejectCollectionSchema,
  handler: rejectCollectionControl,
});

exports[WEN_FUNC.mintCollection] = onRequest({
  name: WEN_FUNC.mintCollection,
  schema: mintCollectionSchema,
  handler: mintCollectionOrderControl,
});

// NFT functions
exports[WEN_FUNC.createNft] = onRequest({
  name: WEN_FUNC.createNft,
  schema: nftCreateSchema,
  handler: createNftControl,
});

exports[WEN_FUNC.createBatchNft] = onRequest({
  name: WEN_FUNC.createBatchNft,
  schema: Joi.array<NftCreateRequest[]>().items(Joi.object().keys(createSchema)).min(1).max(500),
  handler: createBatchNftControl,
});

exports[WEN_FUNC.updateUnsoldNft] = onRequest({
  name: WEN_FUNC.updateUnsoldNft,
  schema: updateUnsoldNftSchema,
  handler: updateUnsoldNftControl,
});

exports[WEN_FUNC.setForSaleNft] = onRequest({
  name: WEN_FUNC.setForSaleNft,
  schema: setNftForSaleSchema,
  handler: setForSaleNftControl,
});

exports[WEN_FUNC.withdrawNft] = onRequest({
  name: WEN_FUNC.withdrawNft,
  schema: nftWithdrawSchema,
  handler: withdrawNftControl,
});

exports[WEN_FUNC.nftTransfer] = onRequest({
  name: WEN_FUNC.nftTransfer,
  schema: nftTransferSchema,
  handler: transferNftsControl,
});

exports[WEN_FUNC.mintMetadataNft] = onRequest({
  name: WEN_FUNC.mintMetadataNft,
  schema: metadataNftSchema,
  handler: mintMetadataNftControl,
});

exports[WEN_FUNC.depositNft] = onRequest({
  name: WEN_FUNC.depositNft,
  schema: depositNftSchema,
  handler: depositNftControl,
});

exports[WEN_FUNC.stakeNft] = onRequest({
  name: WEN_FUNC.stakeNft,
  schema: stakeNftSchema,
  handler: nftStakeControl,
});

exports[WEN_FUNC.orderNft] = onRequest({
  name: WEN_FUNC.orderNft,
  schema: nftPurchaseSchema,
  handler: orderNftControl,
});

exports[WEN_FUNC.orderNftBulk] = onRequest({
  name: WEN_FUNC.orderNftBulk,
  schema: nftPurchaseBulkSchema,
  handler: orderNftBulkControl,
});

exports[WEN_FUNC.openBid] = onRequest({
  name: WEN_FUNC.openBid,
  schema: nftBidSchema,
  handler: nftBidControl,
});

// Address functions
exports[WEN_FUNC.validateAddress] = onRequest({
  name: WEN_FUNC.validateAddress,
  schema: validateAddressSchemaObject,
  handler: validateAddressControl,
});

// TOKEN functions
exports[WEN_FUNC.createToken] = onRequest({
  name: WEN_FUNC.createToken,
  schema: createTokenSchema,
  handler: createTokenControl,
});

exports[WEN_FUNC.updateToken] = onRequest({
  name: WEN_FUNC.updateToken,
  schema: toJoiObject<UidSchemaObject>(uidSchema),
  schemaOptions: { allowUnknown: true },
  handler: updateTokenControl,
});

exports[WEN_FUNC.setTokenAvailableForSale] = onRequest({
  name: WEN_FUNC.setTokenAvailableForSale,
  schema: setAvailableForSaleSchema,
  handler: setTokenAvailableForSaleControl,
});

exports[WEN_FUNC.cancelPublicSale] = onRequest({
  name: WEN_FUNC.cancelPublicSale,
  schema: cancelPubSaleSchema,
  handler: cancelPublicSaleControl,
});

exports[WEN_FUNC.orderToken] = onRequest({
  name: WEN_FUNC.orderToken,
  schema: orderTokenSchema,
  handler: orderTokenControl,
});

exports[WEN_FUNC.creditToken] = onRequest({
  name: WEN_FUNC.creditToken,
  schema: creditTokenSchema,
  handler: creditTokenControl,
});

exports[WEN_FUNC.enableTokenTrading] = onRequest({
  name: WEN_FUNC.enableTokenTrading,
  schema: enableTradingSchema,
  handler: enableTokenTradingControl,
});

exports[WEN_FUNC.airdropToken] = onRequest({
  name: WEN_FUNC.airdropToken,
  schema: airdropTokenSchema,
  handler: airdropTokenControl,
});

exports[WEN_FUNC.claimAirdroppedToken] = onRequest({
  name: WEN_FUNC.claimAirdroppedToken,
  schema: claimAirdroppedTokenSchema,
  handler: claimAirdroppedTokenControl,
});

exports[WEN_FUNC.tradeToken] = onRequest({
  name: WEN_FUNC.tradeToken,
  schema: tradeTokenSchema,
  schemaOptions: { convert: false },
  handler: tradeTokenControl,
});

exports[WEN_FUNC.cancelTradeOrder] = onRequest({
  name: WEN_FUNC.cancelTradeOrder,
  schema: cancelTradeOrderSchema,
  handler: cancelTradeOrderControl,
});

exports[WEN_FUNC.mintTokenOrder] = onRequest({
  name: WEN_FUNC.mintTokenOrder,
  schema: mintTokenSchema,
  handler: mintTokenControl,
});

exports[WEN_FUNC.claimMintedTokenOrder] = onRequest({
  name: WEN_FUNC.claimMintedTokenOrder,
  schema: symbolSchema,
  handler: claimMintedTokenControl,
});

exports[WEN_FUNC.airdropMintedToken] = onRequest({
  name: WEN_FUNC.airdropMintedToken,
  schema: airdropTokenSchema,
  handler: airdropMintedTokenControl,
});

exports[WEN_FUNC.importMintedToken] = onRequest({
  name: WEN_FUNC.importMintedToken,
  schema: importMintedTokenSchema,
  handler: importMintedTokenControl,
});

exports[WEN_FUNC.creditUnrefundable] = onRequest({
  name: WEN_FUNC.creditUnrefundable,
  schema: creditUnrefundableSchema,
  handler: creditUnrefundableControl,
});

exports[WEN_FUNC.depositStake] = onRequest({
  name: WEN_FUNC.depositStake,
  schema: depositStakeSchemaObject,
  handler: depositStakeControl,
});

exports[WEN_FUNC.voteController] = onRequest({
  name: WEN_FUNC.voteController,
  schema: voteSchema,
  handler: voteControl,
});

exports[WEN_FUNC.rankController] = onRequest({
  name: WEN_FUNC.rankController,
  schema: rankSchema,
  handler: rankControl,
});

exports[WEN_FUNC.stakeReward] = onRequest({
  name: WEN_FUNC.stakeReward,
  schema: stakeRewardsSchema,
  handler: stakeRewardControl,
});

exports[WEN_FUNC.removeStakeReward] = onRequest({
  name: WEN_FUNC.removeStakeReward,
  schema: removeStakeRewardSchema,
  handler: removeStakeRewardControl,
});

exports[WEN_FUNC.generateCustomToken] = onRequest({
  name: WEN_FUNC.generateCustomToken,
  schemaOptions: {
    allowUnknown: true,
  },
  schema: customTokenSchema,
  handler: generateCustomTokenControl,
});

exports[WEN_FUNC.uploadFile] = onRequest({
  name: WEN_FUNC.uploadFile,
  schema: Joi.object({}),
  middleware: uploadFile,
  handler: uploadFileControl,
});

exports[WEN_FUNC.stamp] = onRequest({
  name: WEN_FUNC.stamp,
  schema: stampSchema,
  handler: stampCreateControl,
});

exports[WEN_FUNC.createProject] = onRequest({
  name: WEN_FUNC.createProject,
  schema: projectCreateSchema,
  handler: createProjectControl,
  requireProjectApiKey: false,
});

exports[WEN_FUNC.deactivateProject] = onRequest({
  name: WEN_FUNC.deactivateProject,
  schema: toJoiObject({}),
  handler: deactivateProjectControl,
});

exports[WEN_FUNC.bidAuction] = onRequest({
  name: WEN_FUNC.bidAuction,
  schema: auctionBidSchema,
  handler: auctionBidControl,
});

exports[WEN_FUNC.createauction] = onRequest({
  name: WEN_FUNC.createauction,
  schema: auctionCreateSchemaObject,
  handler: auctionCreateControl,
});

exports[WEN_FUNC.createSwap] = onRequest({
  name: WEN_FUNC.createSwap,
  schema: swapCreateSchema,
  handler: swapCreateControl,
});

exports[WEN_FUNC.setSwapFunded] = onRequest({
  name: WEN_FUNC.setSwapFunded,
  schema: swapFundedSchema,
  handler: swapFundedControl,
});

exports[WEN_FUNC.rejectSwap] = onRequest({
  name: WEN_FUNC.rejectSwap,
  schema: swapRejectSchema,
  handler: swapRejectControl,
});
