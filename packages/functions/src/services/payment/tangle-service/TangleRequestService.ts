import {
  COL,
  Member,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Network,
  TangleRequestType,
  Transaction,
  WenError,
} from '@build-5/interfaces';
import * as functions from 'firebase-functions/v2';
import { get } from 'lodash';
import { build5Db } from '../../../firebase/firestore/build5Db';
import { getOutputMetadata } from '../../../utils/basic-output.utils';
import { invalidArgument } from '../../../utils/error.utils';
import { getRandomNonce } from '../../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from '../transaction-service';
import { TangleAddressValidationService } from './address-validation.service';
import { AwardApproveParticipantService } from './award/award.approve.participant.service';
import { AwardCreateService } from './award/award.create.service';
import { AwardFundService } from './award/award.fund.service';
import { MintMetadataNftService } from './metadataNft/mint-metadata-nft.service';
import { TangleNftPurchaseService } from './nft-purchase.service';
import { NftDepositService } from './nft/nft-deposit.service';
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
import { TangleStakeService } from './stake.service';
import { TangleTokenClaimService } from './token-claim.service';
import { TangleTokenTradeService } from './token-trade.service';
export class TangleRequestService {
  constructor(readonly transactionService: TransactionService) {}

  public onTangleRequest = async (
    order: Transaction,
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    match: TransactionMatch,
    build5Transaction?: Transaction,
  ) => {
    let owner = match.from.address;
    let payment: Transaction | undefined;

    try {
      owner = await this.getOwner(match.from.address, order.network!);
      payment = await this.transactionService.createPayment({ ...order, member: owner }, match);
      const request = getOutputMetadata(tranEntry.output).request;
      const response = await this.handleTangleRequest(
        order,
        match,
        payment,
        tran,
        tranEntry,
        owner,
        request,
        build5Transaction,
      );
      if (response) {
        this.transactionService.createTangleCredit(
          payment,
          match,
          { ...response },
          tranEntry.outputId!,
        );
      }
    } catch (error) {
      functions.logger.warn(owner, error);
      if (!payment) {
        payment = await this.transactionService.createPayment({ ...order, member: owner }, match);
      }
      this.transactionService.createTangleCredit(
        payment,
        match,
        {
          status: 'error',
          code: get(error, 'details.code', 1000),
          message: get(error, 'details.key', 'none'),
        },
        tranEntry.outputId!,
      );
    }
  };

  public handleTangleRequest = async (
    order: Transaction,
    match: TransactionMatch,
    payment: Transaction,
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    owner: string,
    request: Record<string, unknown>,
    build5Transaction?: Transaction,
  ) => {
    if (tranEntry.nftOutput) {
      const service = new NftDepositService(this.transactionService);
      return await service.handleNftDeposit(order.network!, owner, tran, tranEntry);
    }
    switch (request.requestType) {
      case TangleRequestType.ADDRESS_VALIDATION: {
        const service = new TangleAddressValidationService(this.transactionService);
        return await service.handeAddressValidation(order, tran, tranEntry, owner, request);
      }
      case TangleRequestType.BUY_TOKEN:
      case TangleRequestType.SELL_TOKEN: {
        const service = new TangleTokenTradeService(this.transactionService);
        return await service.handleTokenTradeTangleRequest(
          match,
          payment,
          tran,
          tranEntry,
          owner,
          request,
          build5Transaction,
        );
      }
      case TangleRequestType.STAKE: {
        const service = new TangleStakeService(this.transactionService);
        return await service.handleStaking(tran, tranEntry, owner, request);
      }
      case TangleRequestType.NFT_PURCHASE: {
        const service = new TangleNftPurchaseService(this.transactionService);
        return await service.handleNftPurchase(tran, tranEntry, owner, request);
      }
      case TangleRequestType.CLAIM_MINTED_AIRDROPS: {
        const service = new TangleTokenClaimService(this.transactionService);
        return await service.handleMintedTokenAirdropRequest(owner, request);
      }
      case TangleRequestType.AWARD_CREATE: {
        const service = new AwardCreateService(this.transactionService);
        return await service.handleCreateRequest(owner, request);
      }
      case TangleRequestType.AWARD_FUND: {
        const service = new AwardFundService(this.transactionService);
        return await service.handleFundRequest(owner, request);
      }
      case TangleRequestType.AWARD_APPROVE_PARTICIPANT: {
        const service = new AwardApproveParticipantService(this.transactionService);
        return await service.handleApproveParticipantRequest(owner, request);
      }
      case TangleRequestType.PROPOSAL_CREATE: {
        const service = new ProposalCreateService(this.transactionService);
        return await service.handleProposalCreateRequest(owner, request);
      }
      case TangleRequestType.PROPOSAL_APPROVE:
      case TangleRequestType.PROPOSAL_REJECT: {
        const service = new ProposalApprovalService(this.transactionService);
        return await service.handleProposalApproval(owner, request);
      }
      case TangleRequestType.PROPOSAL_VOTE: {
        const service = new ProposalVoteService(this.transactionService);
        return await service.handleVoteOnProposal(owner, request, tran, tranEntry);
      }
      case TangleRequestType.SPACE_JOIN: {
        const service = new SpaceJoinService(this.transactionService);
        return await service.handleSpaceJoinRequest(owner, request);
      }
      case TangleRequestType.SPACE_ADD_GUARDIAN:
      case TangleRequestType.SPACE_REMOVE_GUARDIAN: {
        const service = new SpaceGuardianService(this.transactionService);
        return await service.handleEditGuardianRequest(owner, request);
      }
      case TangleRequestType.SPACE_ACCEPT_MEMBER: {
        const service = new SpaceAcceptMemberService(this.transactionService);
        return await service.handleAcceptMemberRequest(owner, request);
      }
      case TangleRequestType.SPACE_BLOCK_MEMBER: {
        const service = new SpaceBlockMemberService(this.transactionService);
        return await service.handleBlockMemberRequest(owner, request);
      }
      case TangleRequestType.SPACE_DECLINE_MEMBER: {
        const service = new SpaceDeclineMemberService(this.transactionService);
        return await service.handleDeclineMemberRequest(owner, request);
      }
      case TangleRequestType.SPACE_LEAVE: {
        const service = new SpaceLeaveService(this.transactionService);
        return await service.handleLeaveSpaceRequest(owner, request);
      }
      case TangleRequestType.SPACE_CREATE: {
        const service = new SpaceCreateService(this.transactionService);
        return await service.handleSpaceCreateRequest(owner, request);
      }
      case TangleRequestType.MINT_METADATA_NFT: {
        const service = new MintMetadataNftService(this.transactionService);
        return await service.handleMetadataNftMintRequest(
          order.network!,
          owner,
          request,
          match,
          tran,
          tranEntry,
        );
      }

      default:
        throw invalidArgument(WenError.invalid_tangle_request_type);
    }
  };

  private getOwner = async (senderAddress: string, network: Network) => {
    const snap = await build5Db()
      .collection(COL.MEMBER)
      .where(`validatedAddress.${network}`, '==', senderAddress)
      .get<Member>();

    if (snap.length > 1) {
      throw invalidArgument(WenError.multiple_members_with_same_address);
    }

    if (snap.length === 1) {
      return snap[0].uid;
    }

    const docRef = build5Db().doc(`${COL.MEMBER}/${senderAddress}`);
    const member = <Member | undefined>await docRef.get();
    if (!member) {
      const memberData = {
        uid: senderAddress,
        nonce: getRandomNonce(),
        validatedAddress: {
          [network as string]: senderAddress,
        },
      };
      await docRef.create(memberData);
    }

    return senderAddress;
  };
}
