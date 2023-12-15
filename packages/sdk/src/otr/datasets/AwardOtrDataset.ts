import {
  AwardApproveParticipantTangleRequest,
  AwardCreateTangleRequest,
  AwardFundTangleRequest,
  TangleRequestType,
} from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

export class AwardOtrDataset extends DatasetClass {
  create = (params: Omit<AwardCreateTangleRequest, 'requestType'>) =>
    new OtrRequest<AwardCreateTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.AWARD_CREATE,
    });

  fund = (params: Omit<AwardFundTangleRequest, 'requestType'>) =>
    new OtrRequest<AwardFundTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.AWARD_FUND,
    });

  approveParticipant = (params: Omit<AwardApproveParticipantTangleRequest, 'requestType'>) =>
    new OtrRequest<AwardApproveParticipantTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.AWARD_APPROVE_PARTICIPANT,
    });
}
