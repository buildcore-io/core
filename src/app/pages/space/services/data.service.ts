import { Injectable, OnDestroy } from '@angular/core';
import { Award, Space } from 'functions/interfaces/models';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Member } from './../../../../../functions/interfaces/models/member';
import { Proposal } from './../../../../../functions/interfaces/models/proposal';
import { AwardApi, AwardFilter } from './../../../@api/award.api';
import { ProposalApi, ProposalFilter } from './../../../@api/proposal.api';
import { SpaceApi } from './../../../@api/space.api';
import { AuthService } from './../../../components/auth/services/auth.service';

@Injectable()
export class DataService implements OnDestroy {
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public isMemberWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public guardians$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  public proposalsActive$: BehaviorSubject<Proposal[]|undefined> = new BehaviorSubject<Proposal[]|undefined>(undefined);
  public proposalsCompleted$: BehaviorSubject<Proposal[]|undefined> = new BehaviorSubject<Proposal[]|undefined>(undefined);
  public awardsActive$: BehaviorSubject<Award[]|undefined> = new BehaviorSubject<Award[]|undefined>(undefined);
  public awardsCompleted$: BehaviorSubject<Award[]|undefined> = new BehaviorSubject<Award[]|undefined>(undefined);
  public members$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  public blockedMembers$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  public pendingMembers$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  private subscriptions$: Subscription[] = [];
  private completedProposalsOn = false;
  private completedAwardsOn = false;

  constructor(
    private auth: AuthService,
    private spaceApi: SpaceApi,
    private awardApi: AwardApi,
    private proposalApi: ProposalApi
  ) {
    // none.
  }

  public loggedInMemberIsGuardian(): boolean {
    if (!this.guardians$.value) {
      return false;
    }

    const currentMemberId: string | undefined = this.auth.member$?.value?.uid;
    if (!currentMemberId) {
      return false;
    }

    return this.guardians$.value.filter(e => e.uid === currentMemberId).length > 0;
  }

  public listenToSpace(id: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.spaceApi.listen(id).subscribe(this.space$));
    this.listenToRelatedRecord(id);
    this.auth.member$.subscribe((m?: Member) => {
      if (m?.uid) {
        this.listenToRelatedRecordWithMember(id, m.uid);
      } else {
        this.isMemberWithinSpace$.next(false);
        this.isGuardianWithinSpace$.next(false);
      }
    });
  }

  public listenToRelatedRecord(spaceId: string): void {
    this.subscriptions$.push(this.spaceApi.listenGuardians(spaceId).subscribe(this.guardians$));
    this.subscriptions$.push(this.spaceApi.listenMembers(spaceId).subscribe(this.members$));
    this.subscriptions$.push(this.proposalApi.listenSpace(spaceId, ProposalFilter.ACTIVE).subscribe(this.proposalsActive$));
    this.subscriptions$.push(this.awardApi.listenSpace(spaceId, AwardFilter.ACTIVE).subscribe(this.awardsActive$));
  }

  public listenToCompletedProposals(spaceId: string): void {
    if (this.completedProposalsOn === true) {
      return;
    }

    this.completedProposalsOn = true;
    this.subscriptions$.push(this.proposalApi.listenSpace(spaceId, ProposalFilter.COMPLETED).subscribe(this.proposalsCompleted$));
  }

  public listenToCompletedAwards(spaceId: string): void {
    if (this.completedAwardsOn === true) {
      return;
    }

    this.completedAwardsOn = true;
    this.subscriptions$.push(this.awardApi.listenSpace(spaceId, AwardFilter.COMPLETED).subscribe(this.awardsCompleted$));
  }

  public listenToRelatedRecordWithMember(spaceId: string, memberId: string): void {
    this.subscriptions$.push(this.spaceApi.isMemberWithinSpace(spaceId, memberId).subscribe(this.isMemberWithinSpace$));
    this.subscriptions$.push(this.spaceApi.isGuardianWithinSpace(spaceId, memberId).subscribe(this.isGuardianWithinSpace$));
    this.subscriptions$.push(this.spaceApi.listenBlockedMembers(spaceId).subscribe(this.blockedMembers$));
    this.subscriptions$.push(this.spaceApi.listenPendingMembers(spaceId).subscribe(this.pendingMembers$));
  }

  public getPendingMembersCount(members?: Member[]|null): number {
    if (!members || !this.isGuardianWithinSpace$.value) {
      return 0;
    }

    return members.length;
  }

  public cancelSubscriptions(): void {
    this.completedProposalsOn = false;
    this.completedAwardsOn = false;
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
