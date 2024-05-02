import {
  AddressValidationTangleRequest,
  SpaceCreateTangleRequest,
  SpaceJoinTangleRequest,
  SpaceLeaveTangleRequest,
  SpaceMemberUpsertTangleRequest,
  TangleRequestType,
} from '@buildcore/interfaces';
import { DatasetClass, OtrRequest } from './common';

/**
 * Space OTR Dataset.
 */
export class SpaceOtrDataset extends DatasetClass {
  /**
   * Validate Address on OTR
   *
   * @param params Use {@link OtrRequest} with data based on {@link AddressValidationTangleRequest}
   * @returns
   */
  validateAddress = (params: Omit<AddressValidationTangleRequest, 'requestType'>) =>
    new OtrRequest<AddressValidationTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.ADDRESS_VALIDATION,
    });
  /**
   * Create Space
   *
   * @param params Use {@link OtrRequest} with data based on {@link SpaceCreateTangleRequest}
   * @returns
   */
  create = (params: Omit<SpaceCreateTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceCreateTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_CREATE,
    });
  /**
   * Join Space
   *
   * @param params Use {@link OtrRequest} with data based on {@link SpaceJoinTangleRequest}
   * @returns
   */
  join = (params: Omit<SpaceJoinTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceJoinTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_JOIN,
    });
  /**
   * Leave Space
   *
   * @param params Use {@link OtrRequest} with data based on {@link SpaceLeaveTangleRequest}
   * @returns
   */
  leave = (params: Omit<SpaceLeaveTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceLeaveTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_LEAVE,
    });
  /**
   * Add guardian
   *
   * @param params Use {@link OtrRequest} with data based on {@link SpaceMemberUpsertTangleRequest}
   * @returns
   */
  addGuardian = (params: Omit<SpaceMemberUpsertTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_ADD_GUARDIAN,
    });
  /**
   * Remove guardian
   *
   * @param params Use {@link OtrRequest} with data based on {@link SpaceMemberUpsertTangleRequest}
   * @returns
   */
  removeGuardian = (params: Omit<SpaceMemberUpsertTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_REMOVE_GUARDIAN,
    });
  /**
   * Accept Member
   *
   * @param params Use {@link OtrRequest} with data based on {@link SpaceMemberUpsertTangleRequest}
   * @returns
   */
  acceptMember = (params: Omit<SpaceMemberUpsertTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_ACCEPT_MEMBER,
    });
  /**
   * Block Member
   *
   * @param params Use {@link OtrRequest} with data based on {@link SpaceMemberUpsertTangleRequest}
   * @returns
   */
  blockMember = (params: Omit<SpaceMemberUpsertTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_BLOCK_MEMBER,
    });
  /**
   * Decline Member
   *
   * @param params Use {@link OtrRequest} with data based on {@link SpaceMemberUpsertTangleRequest}
   * @returns
   */
  declineMember = (params: Omit<SpaceMemberUpsertTangleRequest, 'requestType'>) =>
    new OtrRequest<SpaceMemberUpsertTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.SPACE_DECLINE_MEMBER,
    });
}
