import {
  AddressValidationRequest,
  Build5Request,
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
  create = (req: Build5Request<SpaceCreateRequest>) =>
    this.sendRequest(WEN_FUNC.createSpace)<SpaceCreateRequest, Space>(req);

  update = (req: Build5Request<SpaceUpdateRequest>) =>
    this.sendRequest(WEN_FUNC.updateSpace)<SpaceUpdateRequest, Proposal>(req);

  join = (req: Build5Request<SpaceJoinRequest>) =>
    this.sendRequest(WEN_FUNC.joinSpace)<SpaceJoinRequest, SpaceMember>(req);

  leave = (req: Build5Request<SpaceLeaveRequest>) =>
    this.sendRequest(WEN_FUNC.leaveSpace)<SpaceLeaveRequest, void>(req);

  blockMember = (req: Build5Request<SpaceMemberUpsertRequest>) =>
    this.sendRequest(WEN_FUNC.blockMemberSpace)<SpaceMemberUpsertRequest, SpaceMember>(req);

  unblockMember = (req: Build5Request<SpaceMemberUpsertRequest>) =>
    this.sendRequest(WEN_FUNC.unblockMemberSpace)<SpaceMemberUpsertRequest, void>(req);

  acceptMember = (req: Build5Request<SpaceMemberUpsertRequest>) =>
    this.sendRequest(WEN_FUNC.acceptMemberSpace)<SpaceMemberUpsertRequest, SpaceMember>(req);

  declineMember = (req: Build5Request<SpaceMemberUpsertRequest>) =>
    this.sendRequest(WEN_FUNC.declineMemberSpace)<SpaceMemberUpsertRequest, void>(req);

  addGuardian = (req: Build5Request<SpaceMemberUpsertRequest>) =>
    this.sendRequest(WEN_FUNC.addGuardianSpace)<SpaceMemberUpsertRequest, Proposal>(req);

  removeGuardian = (req: Build5Request<SpaceMemberUpsertRequest>) =>
    this.sendRequest(WEN_FUNC.removeGuardianSpace)<SpaceMemberUpsertRequest, Proposal>(req);

  claim = (req: Build5Request<SpaceClaimRequest>) =>
    this.sendRequest(WEN_FUNC.claimSpace)<SpaceClaimRequest, Transaction>(req);

  validateAddress = (req: Build5Request<AddressValidationRequest>) =>
    this.sendRequest(WEN_FUNC.validateAddress)<AddressValidationRequest, Transaction>(req);

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
