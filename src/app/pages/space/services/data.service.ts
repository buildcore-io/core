import { Injectable, OnDestroy } from '@angular/core';
import { Award, Space } from 'functions/interfaces/models';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Member } from './../../../../../functions/interfaces/models/member';
import { Proposal } from './../../../../../functions/interfaces/models/proposal';
import { AwardApi, AwardFilter } from './../../../@api/award.api';
import { DEFAULT_LIST_SIZE } from './../../../@api/base.api';
import { ProposalApi, ProposalFilter } from './../../../@api/proposal.api';
import { SpaceApi } from './../../../@api/space.api';
import { AuthService } from './../../../components/auth/services/auth.service';

export enum MemberFilterOptions {
  ACTIVE = 'active',
  PENDING = 'pending',
  BLOCKED = 'blocked'
}

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
  private dataStoreMembers: Member[][] = [];
  private dataStorePendingMembers: Member[][] = [];
  private dataStoreBlockedMembers: Member[][] = [];

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
    this.subscriptions$.push(this.proposalApi.listenSpace(spaceId, ProposalFilter.ACTIVE).subscribe(this.proposalsActive$));
    this.subscriptions$.push(this.awardApi.listenSpace(spaceId, AwardFilter.ACTIVE).subscribe(this.awardsActive$));
  }

  public listenToRelatedRecordWithMember(spaceId: string, memberId: string): void {
    this.subscriptions$.push(this.spaceApi.isMemberWithinSpace(spaceId, memberId).subscribe(this.isMemberWithinSpace$));
    this.subscriptions$.push(this.spaceApi.isGuardianWithinSpace(spaceId, memberId).subscribe(this.isGuardianWithinSpace$));
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

  public listenMembers(spaceId: string, lastValue?: any): void {
    this.subscriptions$.push(this.spaceApi.listenMembers(spaceId, lastValue).subscribe(
      this.store.bind(this, this.members$, this.dataStoreMembers, this.dataStoreMembers.length)
    ));
  }

  public listenBlockedMembers(spaceId: string, lastValue?: any): void {
    this.subscriptions$.push(this.spaceApi.listenBlockedMembers(spaceId, lastValue).subscribe(
      this.store.bind(this, this.blockedMembers$, this.dataStoreBlockedMembers, this.dataStoreBlockedMembers.length)
    ));
  }

  public listenPendingMembers(spaceId: string, lastValue?: any): void {
    this.subscriptions$.push(this.spaceApi.listenPendingMembers(spaceId, lastValue).subscribe(
      this.store.bind(this, this.pendingMembers$, this.dataStorePendingMembers, this.dataStorePendingMembers.length)
    ));
  }

  protected store(stream$: BehaviorSubject<any[]|undefined>, store: any[][], page: number, a: any): void {
    if (store[page]) {
      store[page] = a;
    } else {
      store.push(a);
    }

    // Merge arrays.
    stream$.next(Array.prototype.concat.apply([], store));
  }

  public onMemberScroll(spaceId: string, list: MemberFilterOptions): void {
    let store;
    let handler;
    let stream;
    if (list === MemberFilterOptions.PENDING) {
      store = this.dataStorePendingMembers;
      stream = this.pendingMembers$.value;
      handler = this.listenPendingMembers;
    } else if (list === MemberFilterOptions.BLOCKED) {
      store = this.dataStoreBlockedMembers;
      stream = this.blockedMembers$.value;
      handler = this.listenBlockedMembers;
    } else {
      store = this.dataStoreMembers;
      stream = this.members$.value;
      handler = this.listenMembers;
    }

    // Make sure we allow initial load store[0]
    if (store[0] && store[store.length - 1]?.length < DEFAULT_LIST_SIZE) {
      // Finished paging.
      return;
    }

    // For initial load stream will not be defiend.
    const lastValue = stream ? stream[stream.length - 1].createdOn : undefined;
    handler.call(this, spaceId, lastValue);
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
