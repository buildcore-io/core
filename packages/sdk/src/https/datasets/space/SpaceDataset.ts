import {
  AddressValidationRequest,
  BuildcoreRequest,
  Dataset,
  Proposal,
  Space,
  SpaceClaimRequest,
  SpaceCreateRequest,
  SpaceJoinRequest,
  SpaceLeaveRequest,
  SpaceMember,
  SpaceMemberUpsertRequest,
  SpaceUpdateRequest,
  Subset,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { switchMap } from 'rxjs';
import { DatasetClass } from '../Dataset';
import { SubsetType } from '../common';

/**
 * Space Dataset
 */
export class SpaceDataset<D extends Dataset> extends DatasetClass<D, Space> {
  /**
   * Create Space.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SpaceCreateRequest}
   * @returns
   */
  create = (req: BuildcoreRequest<SpaceCreateRequest>) =>
    this.sendRequest(WEN_FUNC.createSpace)<SpaceCreateRequest, Space>(req);
  /**
   * Update Space.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SpaceUpdateRequest}
   * @returns
   */
  update = (req: BuildcoreRequest<SpaceUpdateRequest>) =>
    this.sendRequest(WEN_FUNC.updateSpace)<SpaceUpdateRequest, Proposal>(req);
  /**
   * Join Space.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SpaceJoinRequest}
   * @returns
   */
  join = (req: BuildcoreRequest<SpaceJoinRequest>) =>
    this.sendRequest(WEN_FUNC.joinSpace)<SpaceJoinRequest, SpaceMember>(req);
  /**
   * Leave Space.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SpaceLeaveRequest}
   * @returns
   */
  leave = (req: BuildcoreRequest<SpaceLeaveRequest>) =>
    this.sendRequest(WEN_FUNC.leaveSpace)<SpaceLeaveRequest, void>(req);
  /**
   * Block Member on Space.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SpaceMemberUpsertRequest}
   * @returns
   */
  blockMember = (req: BuildcoreRequest<SpaceMemberUpsertRequest>) =>
    this.sendRequest(WEN_FUNC.blockMemberSpace)<SpaceMemberUpsertRequest, SpaceMember>(req);
  /**
   * Unblock Member on Space.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SpaceMemberUpsertRequest}
   * @returns
   */
  unblockMember = (req: BuildcoreRequest<SpaceMemberUpsertRequest>) =>
    this.sendRequest(WEN_FUNC.unblockMemberSpace)<SpaceMemberUpsertRequest, void>(req);
  /**
   * Accept Member on Space.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SpaceMemberUpsertRequest}
   * @returns
   */
  acceptMember = (req: BuildcoreRequest<SpaceMemberUpsertRequest>) =>
    this.sendRequest(WEN_FUNC.acceptMemberSpace)<SpaceMemberUpsertRequest, SpaceMember>(req);
  /**
   * Decline member on Space.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SpaceMemberUpsertRequest}
   * @returns
   */
  declineMember = (req: BuildcoreRequest<SpaceMemberUpsertRequest>) =>
    this.sendRequest(WEN_FUNC.declineMemberSpace)<SpaceMemberUpsertRequest, void>(req);
  /**
   * Add Guardian on Space.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SpaceMemberUpsertRequest}
   * @returns
   */
  addGuardian = (req: BuildcoreRequest<SpaceMemberUpsertRequest>) =>
    this.sendRequest(WEN_FUNC.addGuardianSpace)<SpaceMemberUpsertRequest, Proposal>(req);
  /**
   * Remove Guardian on Space.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SpaceMemberUpsertRequest}
   * @returns
   */
  removeGuardian = (req: BuildcoreRequest<SpaceMemberUpsertRequest>) =>
    this.sendRequest(WEN_FUNC.removeGuardianSpace)<SpaceMemberUpsertRequest, Proposal>(req);
  /**
   * Claim Space.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SpaceClaimRequest}
   * @returns
   */
  claim = (req: BuildcoreRequest<SpaceClaimRequest>) =>
    this.sendRequest(WEN_FUNC.claimSpace)<SpaceClaimRequest, Transaction>(req);
  /**
   * Validate address on Space.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link AddressValidationRequest}
   * @returns
   */
  validateAddress = (req: BuildcoreRequest<AddressValidationRequest>) =>
    this.sendRequest(WEN_FUNC.validateAddress)<AddressValidationRequest, Transaction>(req);
  /**
   * TODO
   *
   * @param member
   * @param orderBy
   * @param orderByDir
   * @param startAfter
   * @param limit
   * @returns
   */
  getTopByMember = (
    member: string,
    orderBy = ['createdOn'],
    orderByDir = ['desc'],
    startAfter?: string,
    limit?: number,
  ) =>
    (this.subset(Subset.MEMBERS) as SubsetType<Dataset.SPACE, Subset.MEMBERS>)
      .getTopBySubColIdLive(member, orderBy, orderByDir, startAfter, limit)
      .pipe(
        switchMap(async (members) => {
          const promises = members.map((member) => this.id(member.parentId).get());
          return (await Promise.all(promises)).map((s) => s!);
        }),
      );
  /**
   * TODO
   *
   * @param member
   * @param orderBy
   * @param orderByDir
   * @param startAfter
   * @param limit
   * @returns
   */
  getPendingSpacesByMemberLive = (
    member: string,
    orderBy = ['createdOn'],
    orderByDir = ['desc'],
    startAfter?: string,
    limit?: number,
  ) =>
    (this.subset(Subset.KNOCKING_MEMBERS) as SubsetType<Dataset.SPACE, Subset.KNOCKING_MEMBERS>)
      .getTopBySubColIdLive(member, orderBy, orderByDir, startAfter, limit)
      .pipe(
        switchMap(async (members) => {
          const promises = members.map((member) => this.id(member.parentId).get());
          return (await Promise.all(promises)).map((s) => s!);
        }),
      );
}
