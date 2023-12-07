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

  fund = (award: string) =>
    new OtrRequest<AwardFundTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.AWARD_FUND,
      uid: award,
    });

  approveParticipant = (award: string, members: []) =>
    new OtrRequest<AwardApproveParticipantTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.AWARD_APPROVE_PARTICIPANT,
      award,
      members,
    });
}
