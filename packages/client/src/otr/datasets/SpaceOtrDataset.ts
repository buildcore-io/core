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
  validateAddress = (space: string) =>
    new OtrRequest<AddressValidationTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.ADDRESS_VALIDATION,
      space,
    });

  create = (params: Omit<SpaceCreateTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceCreateTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.SPACE_CREATE,
      ...params,
    });

  join = (space: string) =>
    new OtrRequest<SpaceJoinTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.SPACE_JOIN,
      uid: space,
    });

  leave = (space: string) =>
    new OtrRequest<SpaceLeaveTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.SPACE_LEAVE,
      uid: space,
    });

  addGuardian = (space: string, member: string) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.SPACE_ADD_GUARDIAN,
      uid: space,
      member,
    });

  removeGuardian = (space: string, member: string) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.SPACE_REMOVE_GUARDIAN,
      uid: space,
      member,
    });

  acceptMember = (space: string, member: string) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.SPACE_ACCEPT_MEMBER,
      uid: space,
      member,
    });

  blockMember = (space: string, member: string) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.SPACE_BLOCK_MEMBER,
      uid: space,
      member,
    });

  declineMember = (space: string, member: string) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.SPACE_DECLINE_MEMBER,
      uid: space,
      member,
    });
}
