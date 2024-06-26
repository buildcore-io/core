import { database } from '@buildcore/database';
import {
  COL,
  Network,
  NetworkAddress,
  TangleRequestType,
  TangleResponse,
  Transaction,
  ValidatedAddress,
  WenError,
} from '@buildcore/interfaces';
import { get, isEmpty, set } from 'lodash';
import { getOutputMetadata } from '../../../utils/basic-output.utils';
import { invalidArgument } from '../../../utils/error.utils';
import { logger } from '../../../utils/logger';
import { getRandomNonce } from '../../../utils/wallet.utils';
import { BaseTangleService, HandlerParams } from '../base';
import { TangleAddressValidationService } from './address/address-validation.service';
import { TangleAuctionBidService, TangleNftAuctionBidService } from './auction/auction.bid.service';
import { TangleAuctionCreateService } from './auction/auction.create.service';
import { AwardApproveParticipantService } from './award/award.approve.participant.service';
import { AwardCreateService } from './award/award.create.service';
import { AwardFundService } from './award/award.fund.service';
import { VerifyEthForBuilTokenTangleService } from './buildcore-token/verify.eth.for.buildtoken.service';
import { MintMetadataNftService } from './metadataNft/mint-metadata-nft.service';
import { NftDepositService } from './nft/nft-deposit.service';
import { TangleNftPurchaseBulkService } from './nft/nft-purchase.bulk.service';
import { TangleNftPurchaseService } from './nft/nft-purchase.service';
import { TangleNftSetForSaleService } from './nft/nft-set-for-sale.service';
import { TangleNftTransferService } from './nft/nft-transfer.service';
import { ProposalApprovalService } from './proposal/ProposalApporvalService';
import { ProposalCreateService } from './proposal/ProposalCreateService';
import { ProposalVoteService } from './proposal/voting/ProposalVoteService';
import { SpaceAcceptMemberService } from './space/SpaceAcceptMemberService';
import { SpaceBlockMemberService } from './space/SpaceBlockMemberService';
import { SpaceCreateService } from './space/SpaceCreateService';
import { SpaceDeclineMemberService } from './space/SpaceDeclineMemberService';
import { SpaceGuardianService } from './space/SpaceGuardianService';
import { SpaceJoinService } from './space/SpaceJoinService';
import { SpaceLeaveService } from './space/SpaceLeaveService';
import { StampTangleService } from './stamp/StampTangleService';
import { SwapCreateTangleService } from './swap/SwapCreateTangleService';
import { SwapRejectTangleService } from './swap/SwapRejectTangleService';
import { SwapSetFundedTangleService } from './swap/SwapSetFundedTangleService';
import { TangleStakeService } from './token/stake.service';
import { TangleTokenClaimService } from './token/token-claim.service';
import { TangleTokenTradeService } from './token/token-trade.service';

export class TangleRequestService extends BaseTangleService<TangleResponse> {
  public handleRequest = async (params: HandlerParams) => {
    const { match, order, tranEntry } = params;
    let owner = match.from;
    let payment: Transaction | undefined;

    try {
      owner = await this.getOwner(match.from, order.network!);
      payment = await this.transactionService.createPayment({ ...order, member: owner }, match);
      const request = getOutputMetadata(tranEntry.output).request;

      const serviceParams = { ...params, request, payment, owner };
      const service = this.getService(serviceParams);
      const response = await service.handleRequest(serviceParams);

      if (!isEmpty(response)) {
        this.transactionService.createTangleCredit(
          payment,
          match,
          { ...response },
          tranEntry.outputId!,
        );
      }
    } catch (error) {
      logger.warn('tangle service error warning', owner, error);
      if (!payment) {
        payment = await this.transactionService.createPayment({ ...order, member: owner }, match);
      }

      const response = {
        status: 'error',
        code: get(error, 'eCode', 1000),
        message: get(error, 'eKey', 'none'),
      };
      if (get(error, 'eMessage', '')) {
        set(response, 'exp', get(error, 'eMessage', ''));
      }
      this.transactionService.createTangleCredit(payment, match, response, tranEntry.outputId!);
    }

    return {};
  };

  private getService = (params: HandlerParams): BaseTangleService<TangleResponse> => {
    if (params.tranEntry.nftOutput) {
      return new NftDepositService(this.transactionService);
    }
    switch (params.request.requestType) {
      case TangleRequestType.ADDRESS_VALIDATION:
        return new TangleAddressValidationService(this.transactionService);
      case TangleRequestType.BUY_TOKEN:
      case TangleRequestType.SELL_TOKEN:
        return new TangleTokenTradeService(this.transactionService);
      case TangleRequestType.STAKE:
        return new TangleStakeService(this.transactionService);
      case TangleRequestType.NFT_PURCHASE:
        return new TangleNftPurchaseService(this.transactionService);
      case TangleRequestType.NFT_PURCHASE_BULK:
        return new TangleNftPurchaseBulkService(this.transactionService);
      case TangleRequestType.NFT_SET_FOR_SALE:
        return new TangleNftSetForSaleService(this.transactionService);
      case TangleRequestType.NFT_BID:
        return new TangleNftAuctionBidService(this.transactionService);
      case TangleRequestType.CLAIM_MINTED_AIRDROPS:
        return new TangleTokenClaimService(this.transactionService);
      case TangleRequestType.AWARD_CREATE:
        return new AwardCreateService(this.transactionService);
      case TangleRequestType.AWARD_FUND:
        return new AwardFundService(this.transactionService);
      case TangleRequestType.AWARD_APPROVE_PARTICIPANT:
        return new AwardApproveParticipantService(this.transactionService);
      case TangleRequestType.PROPOSAL_CREATE:
        return new ProposalCreateService(this.transactionService);
      case TangleRequestType.PROPOSAL_APPROVE:
        return new ProposalApprovalService(this.transactionService);
      case TangleRequestType.PROPOSAL_REJECT:
        return new ProposalApprovalService(this.transactionService);
      case TangleRequestType.PROPOSAL_VOTE:
        return new ProposalVoteService(this.transactionService);
      case TangleRequestType.SPACE_JOIN:
        return new SpaceJoinService(this.transactionService);
      case TangleRequestType.SPACE_ADD_GUARDIAN:
        return new SpaceGuardianService(this.transactionService);
      case TangleRequestType.SPACE_REMOVE_GUARDIAN:
        return new SpaceGuardianService(this.transactionService);
      case TangleRequestType.SPACE_ACCEPT_MEMBER:
        return new SpaceAcceptMemberService(this.transactionService);
      case TangleRequestType.SPACE_BLOCK_MEMBER:
        return new SpaceBlockMemberService(this.transactionService);
      case TangleRequestType.SPACE_DECLINE_MEMBER:
        return new SpaceDeclineMemberService(this.transactionService);
      case TangleRequestType.SPACE_LEAVE:
        return new SpaceLeaveService(this.transactionService);
      case TangleRequestType.SPACE_CREATE:
        return new SpaceCreateService(this.transactionService);
      case TangleRequestType.MINT_METADATA_NFT:
        return new MintMetadataNftService(this.transactionService);
      case TangleRequestType.STAMP:
        return new StampTangleService(this.transactionService);
      case TangleRequestType.CREATE_AUCTION:
        return new TangleAuctionCreateService(this.transactionService);
      case TangleRequestType.BID_AUCTION:
        return new TangleAuctionBidService(this.transactionService);
      case TangleRequestType.NFT_TRANSFER:
        return new TangleNftTransferService(this.transactionService);
      case TangleRequestType.CREATE_SWAP:
        return new SwapCreateTangleService(this.transactionService);
      case TangleRequestType.SET_SWAP_FUNDED:
        return new SwapSetFundedTangleService(this.transactionService);
      case TangleRequestType.REJECT_SWAP:
        return new SwapRejectTangleService(this.transactionService);
      case TangleRequestType.VERIFY_ETH_ADDRESS:
        return new VerifyEthForBuilTokenTangleService(this.transactionService);
      default:
        throw invalidArgument(WenError.invalid_tangle_request_type);
    }
  };

  private getOwner = async (senderAddress: NetworkAddress, network: Network) => {
    const docRef = database().doc(COL.MEMBER, senderAddress);
    const member = await docRef.get();
    if (member) {
      return senderAddress;
    }

    const snap = await database()
      .collection(COL.MEMBER)
      .where(`${network}Address`, '==', senderAddress)
      .limit(2)
      .get();

    if (snap.length > 1) {
      throw invalidArgument(WenError.multiple_members_with_same_address);
    }

    if (snap.length === 1) {
      return snap[0].uid;
    }

    const memberData = {
      uid: senderAddress,
      nonce: getRandomNonce(),
      validatedAddress: {
        [network as string]: senderAddress,
      } as unknown as ValidatedAddress,
    };
    await docRef.create(memberData);

    return senderAddress;
  };
}
