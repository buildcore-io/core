import {
  AddressValidationTangleRequest,
  SpaceCreateTangleRequest,
  SpaceJoinTangleRequest,
  SpaceLeaveTangleRequest,
  SpaceMemberUpsertTangleRequest,
  TangleRequestType,
} from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

export class SpaceOtrDataset extends DatasetClass {
  validateAddress = (params: Omit<AddressValidationTangleRequest, 'requestType'>) =>
    new OtrRequest<AddressValidationTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.ADDRESS_VALIDATION,
    });

  create = (params: Omit<SpaceCreateTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceCreateTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_CREATE,
    });

  join = (params: Omit<SpaceJoinTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceJoinTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_JOIN,
    });

  leave = (params: Omit<SpaceLeaveTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceLeaveTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_LEAVE,
    });

  addGuardian = (params: Omit<SpaceMemberUpsertTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_ADD_GUARDIAN,
    });

  removeGuardian = (params: Omit<SpaceMemberUpsertTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_REMOVE_GUARDIAN,
    });

  acceptMember = (params: Omit<SpaceMemberUpsertTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_ACCEPT_MEMBER,
    });

  blockMember = (params: Omit<SpaceMemberUpsertTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_BLOCK_MEMBER,
    });

  declineMember = (params: Omit<SpaceMemberUpsertTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_DECLINE_MEMBER,
    });
}
