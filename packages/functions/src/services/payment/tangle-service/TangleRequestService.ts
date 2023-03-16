import {
  COL,
  Member,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Network,
  TangleRequestType,
  Transaction,
  TransactionOrder,
  URL_PATHS,
  WenError,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { get } from 'lodash';
import admin from '../../../admin.config';
import { getOutputMetadata } from '../../../utils/basic-output.utils';
import { cOn } from '../../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../../utils/error.utils';
import { getRandomNonce } from '../../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from '../transaction-service';
import { TangleAddressValidationService } from './address-validation.service';
import { AwardApproveParticipantService } from './award/award.approve.participant.service';
import { AwardCreateService } from './award/award.create.service';
import { AwardFundService } from './award/award.fund.service';
import { TangleNftPurchaseService } from './nft-purchase.service';
import { ProposalApprovalService } from './proposal/ProposalApporvalService';
import { ProposalCreateService } from './proposal/ProposalCreateService';
import { ProposalVoteService } from './proposal/voting/ProposalVoteService';
import { SpaceAcceptMemberService } from './space/SpaceAcceptMemberService';
import { SpaceBlockMemberService } from './space/SpaceBlockMemberService';
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
    order: TransactionOrder,
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    match: TransactionMatch,
    soonTransaction?: Transaction,
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
        soonTransaction,
      );
      if (response) {
        this.transactionService.createTangleCredit(payment, match, response, tranEntry.outputId!);
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
    order: TransactionOrder,
    match: TransactionMatch,
    payment: Transaction,
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    owner: string,
    request: Record<string, unknown>,
    soonTransaction?: Transaction,
  ) => {
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
          soonTransaction,
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
      default:
        throw throwInvalidArgument(WenError.invalid_tangle_request_type);
    }
  };

  private getOwner = async (senderAddress: string, network: Network) => {
    const snap = await admin
      .firestore()
      .collection(COL.MEMBER)
      .where(`validatedAddress.${network}`, '==', senderAddress)
      .get();

    if (snap.size > 1) {
      throw throwInvalidArgument(WenError.multiple_members_with_same_address);
    }

    if (snap.size === 1) {
      return snap.docs[0].id;
    }

    const docRef = admin.firestore().doc(`${COL.MEMBER}/${senderAddress}`);
    const member = <Member | undefined>(await docRef.get()).data();
    if (!member) {
      const memberData = {
        uid: senderAddress,
        nonce: getRandomNonce(),
        validatedAddress: {
          [network as string]: senderAddress,
        },
      };
      await docRef.create(cOn(memberData, URL_PATHS.MEMBER));
    }

    return senderAddress;
  };
}
