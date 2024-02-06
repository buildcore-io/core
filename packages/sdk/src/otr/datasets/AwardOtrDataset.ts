import {
  AwardApproveParticipantTangleRequest,
  AwardCreateTangleRequest,
  AwardFundTangleRequest,
  TangleRequestType,
} from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

/**
 * Award OTR Dataset
 */
export class AwardOtrDataset extends DatasetClass {
  /**
   * Create Award via OTR
   *
   * @param params Use {@link OtrRequest} with data based on {@link AuctionBidTangleRequest}
   * @returns
   */
  create = (params: Omit<AwardCreateTangleRequest, 'requestType'>) =>
    new OtrRequest<AwardCreateTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.AWARD_CREATE,
    });
  /**
   * Fund award via OTR
   *
   * @param params Use {@link OtrRequest} with data based on {@link AuctionBidTangleRequest}
   * @returns
   */
  fund = (params: Omit<AwardFundTangleRequest, 'requestType'>) =>
    new OtrRequest<AwardFundTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.AWARD_FUND,
    });
  /**
   * Approve participant on the Award
   *
   * @param params Use {@link OtrRequest} with data based on {@link AuctionBidTangleRequest}
   * @returns
   */
  approveParticipant = (params: Omit<AwardApproveParticipantTangleRequest, 'requestType'>) =>
    new OtrRequest<AwardApproveParticipantTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.AWARD_APPROVE_PARTICIPANT,
    });
}
