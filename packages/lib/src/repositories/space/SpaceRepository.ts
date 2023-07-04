import { PublicCollections, Space } from '@build-5/interfaces';
import { switchMap } from 'rxjs';
import { Build5Env } from '../../Config';
import { CrudRepository } from '../CrudRepository';
import { SpaceKnockingMemberRepository } from './SpaceKnockingMemberRepository';
import { SpaceMemberRepository } from './SpaceMemberRepository';

export class SpaceRepository extends CrudRepository<Space> {
  private memberRepo: SpaceMemberRepository;
  private knockingMemberRepo: SpaceKnockingMemberRepository;
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.SPACE);
    this.memberRepo = new SpaceMemberRepository(env);
    this.knockingMemberRepo = new SpaceKnockingMemberRepository(env);
  }

  public getTopByMember = (
    member: string,
    orderBy = ['createdOn'],
    orderByDir = ['desc'],
    startAfter?: string,
    limit?: number,
  ) => {
    const spaceMember = this.memberRepo.getTopBySubColIdLive(
      member,
      orderBy,
      orderByDir,
      startAfter,
      limit,
    );
    return spaceMember.pipe(
      switchMap(async (members) => {
        const promises = members.map((member) => this.getById(member.parentId));
        return (await Promise.all(promises)).map((s) => s!);
      }),
    );
  };

  public getPendingSpacesByMemberLive = (
    member: string,
    orderBy = ['createdOn'],
    orderByDir = ['desc'],
    startAfter?: string,
    limit?: number,
  ) => {
    const spaceMember = this.knockingMemberRepo.getTopBySubColIdLive(
      member,
      orderBy,
      orderByDir,
      startAfter,
      limit,
    );
    return spaceMember.pipe(
      switchMap(async (members) => {
        const promises = members.map((member) => this.getById(member.parentId));
        return (await Promise.all(promises)).map((s) => s!);
      }),
    );
  };
}
