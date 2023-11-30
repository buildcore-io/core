import {
  AddressValidationRequest,
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
} from '@build-5/interfaces';
import { switchMap } from 'rxjs';
import { DatasetClass } from '../Dataset';
import { SubsetType } from '../common';

export class SpaceDataset<D extends Dataset> extends DatasetClass<D, Space> {
  create = this.sendRequest(WEN_FUNC.createSpace)<SpaceCreateRequest, Space>;

  update = this.sendRequest(WEN_FUNC.updateSpace)<SpaceUpdateRequest, Proposal>;

  join = this.sendRequest(WEN_FUNC.joinSpace)<SpaceJoinRequest, SpaceMember>;

  leave = this.sendRequest(WEN_FUNC.leaveSpace)<SpaceLeaveRequest, void>;

  blockMember = this.sendRequest(WEN_FUNC.blockMemberSpace)<SpaceMemberUpsertRequest, SpaceMember>;

  unblockMember = this.sendRequest(WEN_FUNC.unblockMemberSpace)<SpaceMemberUpsertRequest, void>;

  acceptMember = this.sendRequest(WEN_FUNC.acceptMemberSpace)<
    SpaceMemberUpsertRequest,
    SpaceMember
  >;

  declineMember = this.sendRequest(WEN_FUNC.declineMemberSpace)<SpaceMemberUpsertRequest, void>;

  addGuardian = this.sendRequest(WEN_FUNC.addGuardianSpace)<SpaceMemberUpsertRequest, Proposal>;

  removeGuardian = this.sendRequest(WEN_FUNC.removeGuardianSpace)<
    SpaceMemberUpsertRequest,
    Proposal
  >;

  claim = this.sendRequest(WEN_FUNC.claimSpace)<SpaceClaimRequest, Transaction>;

  validateAddress = this.sendRequest(WEN_FUNC.validateAddress)<
    AddressValidationRequest,
    Transaction
  >;

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
