import { Injectable, OnDestroy } from '@angular/core';
import { CollectionApi } from '@api/collection.api';
import { MemberApi } from '@api/member.api';
import { TokenApi } from '@api/token.api';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { BADGE_TO_CREATE_COLLECTION } from '@functions/interfaces/config';
import { Award, Collection, Space } from '@functions/interfaces/models';
import { Token } from '@functions/interfaces/models/token';
import { BehaviorSubject, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
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

@Injectable({
  providedIn: 'any'
})
export class DataService implements OnDestroy {
  public space$: BehaviorSubject<Space | undefined> = new BehaviorSubject<Space | undefined>(undefined);
  public isMemberWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public isPendingMemberWithSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public isAllowCollectionCreation$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public guardians$: BehaviorSubject<Member[] | undefined> = new BehaviorSubject<Member[] | undefined>(undefined);
  public proposalsDraft$: BehaviorSubject<Proposal[] | undefined> = new BehaviorSubject<Proposal[] | undefined>(undefined);
  public proposalsActive$: BehaviorSubject<Proposal[] | undefined> = new BehaviorSubject<Proposal[] | undefined>(undefined);
  public proposalsRejected$: BehaviorSubject<Proposal[] | undefined> = new BehaviorSubject<Proposal[] | undefined>(undefined);
  public proposalsCompleted$: BehaviorSubject<Proposal[] | undefined> = new BehaviorSubject<Proposal[] | undefined>(undefined);
  public awardsDraft$: BehaviorSubject<Award[] | undefined> = new BehaviorSubject<Award[] | undefined>(undefined);
  public awardsActive$: BehaviorSubject<Award[] | undefined> = new BehaviorSubject<Award[] | undefined>(undefined);
  public awardsRejected$: BehaviorSubject<Award[] | undefined> = new BehaviorSubject<Award[] | undefined>(undefined);
  public awardsCompleted$: BehaviorSubject<Award[] | undefined> = new BehaviorSubject<Award[] | undefined>(undefined);
  public members$: BehaviorSubject<Member[] | undefined> = new BehaviorSubject<Member[] | undefined>(undefined);
  public blockedMembers$: BehaviorSubject<Member[] | undefined> = new BehaviorSubject<Member[] | undefined>(undefined);
  public pendingMembers$: BehaviorSubject<Member[] | undefined> = new BehaviorSubject<Member[] | undefined>(undefined);
  public rejectedCollections$: BehaviorSubject<Collection[] | undefined> = new BehaviorSubject<Collection[] | undefined>(undefined);
  public pendingCollections$: BehaviorSubject<Collection[] | undefined> = new BehaviorSubject<Collection[] | undefined>(undefined);
  public availableCollections$: BehaviorSubject<Collection[] | undefined> = new BehaviorSubject<Collection[] | undefined>(undefined);
  public token$: BehaviorSubject<Token | undefined> = new BehaviorSubject<Token | undefined>(undefined);
  private subscriptions$: Subscription[] = [];
  private subscriptionsRelatedRecords$: Subscription[] = [];
  private completedProposalsOn = false;
  private rejectedProposalsOn = false;
  private draftProposalsOn = false;
  private completedAwardsOn = false;
  private rejectedAwardsOn = false;
  private draftAwardsOn = false;
  private availableCollectionOn = false;
  private rejectedCollectionOn = false;
  private pendingCollectionOn = false;
  private dataStoreMembers: Member[][] = [];
  private dataStorePendingMembers: Member[][] = [];
  private dataStoreBlockedMembers: Member[][] = [];

  constructor(
    private auth: AuthService,
    private spaceApi: SpaceApi,
    private awardApi: AwardApi,
    private memberApi: MemberApi,
    private proposalApi: ProposalApi,
    private collectionApi: CollectionApi,
    private tokenApi: TokenApi
  ) {
    // none.
  }

  // TODO Change into a stream.
  // public loggedInMemberIsGuardian(): boolean {
  //   if (!this.guardians$.value) {
  //     return false;
  //   }

  //   const currentMemberId: string | undefined = this.auth.member$?.value?.uid;
  //   if (!currentMemberId) {
  //     return false;
  //   }

  //   return this.guardians$.value.filter(e => e.uid === currentMemberId).length > 0;
  // }

  public listenToSpace(id: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.spaceApi.listen(id).subscribe(this.space$));
    this.listenToRelatedRecord(id);
    let listeningMember: string | undefined;
    this.auth.member$.subscribe((m?: Member) => {
      if (listeningMember === m?.uid) {
        return;
      }

      if (m?.uid) {
        this.listenToRelatedRecordWithMember(id, m.uid);
        listeningMember = m.uid;
      } else {
        this.isMemberWithinSpace$.next(false);
        this.isGuardianWithinSpace$.next(false);
        this.isPendingMemberWithSpace$.next(false);
        listeningMember = undefined;
      }
    });
  }

  public listenToRelatedRecord(spaceId: string): void {
    this.subscriptions$.push(this.spaceApi.listenGuardians(spaceId).subscribe(this.guardians$));
    this.subscriptions$.push(this.proposalApi.listenSpace(spaceId, ProposalFilter.ACTIVE).subscribe(this.proposalsActive$));
    this.subscriptions$.push(this.awardApi.listenSpace(spaceId, AwardFilter.ACTIVE).subscribe(this.awardsActive$));
  }

  public listenToRelatedRecordWithMember(spaceId: string, memberId: string): void {
    this.resetRelatedRecordsSubjects();
    this.subscriptionsRelatedRecords$?.forEach((s) => {
      s.unsubscribe();
    });
    this.subscriptionsRelatedRecords$.push(this.spaceApi.isMemberWithinSpace(spaceId, memberId).subscribe(this.isMemberWithinSpace$));
    this.subscriptionsRelatedRecords$.push(this.spaceApi.isGuardianWithinSpace(spaceId, memberId).subscribe(this.isGuardianWithinSpace$));
    this.subscriptionsRelatedRecords$.push(this.spaceApi.isPendingMemberWithinSpace(spaceId, memberId).subscribe(this.isPendingMemberWithSpace$));
    this.subscriptionsRelatedRecords$.push(this.memberApi.hasBadge(memberId, BADGE_TO_CREATE_COLLECTION).subscribe(this.isAllowCollectionCreation$));
  }

  public listenToCompletedProposals(spaceId: string): void {
    if (this.completedProposalsOn === true) {
      return;
    }

    this.completedProposalsOn = true;
    this.subscriptions$.push(this.proposalApi.listenSpace(spaceId, ProposalFilter.COMPLETED).subscribe(this.proposalsCompleted$));
  }

  public formatTokenBest(amount?: number|null): string {
    if (!amount) {
      return '0';
    }

    return (amount / 1000 / 1000).toFixed(2).toString();
  }

  public listenToRejectedProposals(spaceId: string): void {
    if (this.rejectedProposalsOn === true) {
      return;
    }

    this.rejectedProposalsOn = true;
    this.subscriptions$.push(this.proposalApi.listenSpace(spaceId, ProposalFilter.REJECTED).subscribe(this.proposalsRejected$));
  }

  public listenToDraftProposals(spaceId: string): void {
    if (this.draftProposalsOn === true) {
      return;
    }

    this.draftProposalsOn = true;
    this.subscriptions$.push(this.proposalApi.listenSpace(spaceId, ProposalFilter.DRAFT).subscribe(this.proposalsDraft$));
  }

  public listenToCompletedAwards(spaceId: string): void {
    if (this.completedAwardsOn === true) {
      return;
    }

    this.completedAwardsOn = true;
    this.subscriptions$.push(this.awardApi.listenSpace(spaceId, AwardFilter.COMPLETED).subscribe(this.awardsCompleted$));
  }

  public listenToRejectedAwards(spaceId: string): void {
    if (this.rejectedAwardsOn === true) {
      return;
    }

    this.rejectedAwardsOn = true;
    this.subscriptions$.push(this.awardApi.listenSpace(spaceId, AwardFilter.REJECTED).subscribe(this.awardsRejected$));
  }

  public listenToDraftAwards(spaceId: string): void {
    if (this.draftAwardsOn === true) {
      return;
    }

    this.draftAwardsOn = true;
    this.subscriptions$.push(this.awardApi.listenSpace(spaceId, AwardFilter.DRAFT).subscribe(this.awardsDraft$));
  }

  public listenToPendingCollections(spaceId: string): void {
    if (this.pendingCollectionOn === true) {
      return;
    }

    this.pendingCollectionOn = true;
    this.subscriptions$.push(this.collectionApi.allPendingSpace(spaceId).subscribe(this.pendingCollections$));
  }

  public listenToAvailableCollections(spaceId: string): void {
    if (this.availableCollectionOn === true) {
      return;
    }

    this.availableCollectionOn = true;
    this.subscriptions$.push(this.collectionApi.allAvailableSpace(spaceId).subscribe(this.availableCollections$));
  }

  public listenToRejectedCollections(spaceId: string): void {
    if (this.rejectedCollectionOn === true) {
      return;
    }

    this.rejectedCollectionOn = true;
    this.subscriptions$.push(this.collectionApi.allRejectedSpace(spaceId).subscribe(this.rejectedCollections$));
  }

  public listenToTokens(spaceId: string): void {
    this.subscriptions$.push(
      this.tokenApi.space(spaceId)
        .pipe(
          map((tokens: Token[] | undefined) => (tokens || [])?.[0] || null)
        )
        .subscribe(this.token$)
    );
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  public listenMembers(spaceId: string, lastValue?: number, searchIds?: string[]): void {
    this.subscriptions$.push(this.spaceApi.listenMembers(spaceId, lastValue, searchIds).subscribe(
      this.store.bind(this, this.members$, this.dataStoreMembers, this.dataStoreMembers.length)
    ));
  }

  public listenBlockedMembers(spaceId: string, lastValue?: number, searchIds?: string[]): void {
    this.subscriptions$.push(this.spaceApi.listenBlockedMembers(spaceId, lastValue, searchIds).subscribe(
      this.store.bind(this, this.blockedMembers$, this.dataStoreBlockedMembers, this.dataStoreBlockedMembers.length)
    ));
  }

  public listenPendingMembers(spaceId: string, lastValue?: any, searchIds?: string[]): void {
    this.subscriptions$.push(this.spaceApi.listenPendingMembers(spaceId, lastValue, searchIds).subscribe(
      this.store.bind(this, this.pendingMembers$, this.dataStorePendingMembers, this.dataStorePendingMembers.length)
    ));
  }

  protected store(stream$: BehaviorSubject<any[] | undefined>, store: any[][], page: number, a: any): void {
    if (store[page]) {
      store[page] = a;
    } else {
      store.push(a);
    }

    // Merge arrays.
    stream$.next(Array.prototype.concat.apply([], store));
  }

  public onMemberScroll(spaceId: string, list: MemberFilterOptions, searchIds?: string[]): void {
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
    if (store[0] && (!store[store.length - 1] || store[store.length - 1]?.length < DEFAULT_LIST_SIZE)) {
      // Finished paging.
      return;
    }

    // For initial load stream will not be defiend.
    const lastValue = stream ? stream[stream.length - 1].createdOn : undefined;
    handler.call(this, spaceId, lastValue, searchIds);
  }

  public getPendingMembersCount(members?: Member[] | null): number {
    if (!members || !this.isGuardianWithinSpace$.value) {
      return 0;
    }

    return members.length;
  }

  public resetSubjects(): void {
    // Clean up all streams.
    this.guardians$.next(undefined);
    this.proposalsDraft$.next(undefined);
    this.proposalsRejected$.next(undefined);
    this.proposalsActive$.next(undefined);
    this.proposalsCompleted$.next(undefined);
    this.awardsActive$.next(undefined);
    this.awardsRejected$.next(undefined);
    this.awardsDraft$.next(undefined);
    this.awardsCompleted$.next(undefined);
    this.rejectedCollections$.next(undefined);
    this.pendingCollections$.next(undefined);
    this.availableCollections$.next(undefined);
    this.resetMembersSubjects();
  }

  public resetMembersSubjects(): void {
    this.members$.next(undefined);
    this.blockedMembers$.next(undefined);
    this.pendingMembers$.next(undefined);
  }

  public resetMembersDataStore(): void {
    this.dataStoreMembers = [];
    this.dataStorePendingMembers = [];
    this.dataStoreBlockedMembers = [];
  }

  public resetRelatedRecordsSubjects(): void {
    this.isMemberWithinSpace$.next(false);
    this.isGuardianWithinSpace$.next(false);
    this.isPendingMemberWithSpace$.next(false);
  }

  public cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });

    this.subscriptionsRelatedRecords$.forEach((s) => {
      s.unsubscribe();
    });

    this.completedProposalsOn = false;
    this.rejectedProposalsOn = false;
    this.draftProposalsOn = false;
    this.completedAwardsOn = false;
    this.draftAwardsOn = false;
    this.rejectedAwardsOn = false;
    this.availableCollectionOn = false;
    this.rejectedCollectionOn = false;
    this.pendingCollectionOn = false;
    this.resetMembersDataStore();
    this.resetSubjects();
    this.resetRelatedRecordsSubjects();
  }

  public getMemberUrl(memberId: string): string[] {
    return ['/', ROUTER_UTILS.config.member.root, memberId];
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
    this.space$.next(undefined);
  }
}