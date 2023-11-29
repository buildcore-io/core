import {
  AddressValidationRequest,
  Dataset,
  Space,
  SpaceClaimRequest,
  SpaceCreateRequest,
  SpaceJoinRequest,
  SpaceLeaveRequest,
  SpaceMemberUpsertRequest,
  SpaceUpdateRequest,
  Subset,
  WEN_FUNC,
} from '@build-5/interfaces';
import { switchMap } from 'rxjs';
import { DatasetClass } from '../Dataset';
import { SubsetType } from '../common';

export class SpaceDataset<D extends Dataset> extends DatasetClass<D, Space> {
  create = this.sendRequest(WEN_FUNC.createSpace)<SpaceCreateRequest>;

  update = this.sendRequest(WEN_FUNC.updateSpace)<SpaceUpdateRequest>;

  join = this.sendRequest(WEN_FUNC.joinSpace)<SpaceJoinRequest>;

  leave = this.sendRequest(WEN_FUNC.leaveSpace)<SpaceLeaveRequest>;

  blockMember = this.sendRequest(WEN_FUNC.blockMemberSpace)<SpaceMemberUpsertRequest>;

  unblockMember = this.sendRequest(WEN_FUNC.unblockMemberSpace)<SpaceMemberUpsertRequest>;

  acceptMember = this.sendRequest(WEN_FUNC.acceptMemberSpace)<SpaceMemberUpsertRequest>;

  declineMember = this.sendRequest(WEN_FUNC.declineMemberSpace)<SpaceMemberUpsertRequest>;

  addGuardian = this.sendRequest(WEN_FUNC.addGuardianSpace)<SpaceMemberUpsertRequest>;

  removeGuardian = this.sendRequest(WEN_FUNC.removeGuardianSpace)<SpaceMemberUpsertRequest>;

  claim = this.sendRequest(WEN_FUNC.claimSpace)<SpaceClaimRequest>;

  validateAddress = this.sendRequest(WEN_FUNC.validateAddress)<AddressValidationRequest>;

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
