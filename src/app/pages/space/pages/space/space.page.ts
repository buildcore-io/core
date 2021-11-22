import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FileApi, FILE_SIZES } from "@api/file.api";
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from "@pages/space/services/data.service";
import { Space } from "functions/interfaces/models";
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';
import { Member } from './../../../../../../functions/interfaces/models/member';
import { AwardApi, AwardFilter } from './../../../../@api/award.api';
import { ProposalApi, ProposalFilter } from './../../../../@api/proposal.api';
import { SpaceApi } from './../../../../@api/space.api';
import { NavigationService } from './../../../../@core/services/navigation/navigation.service';
import { NotificationService } from './../../../../@core/services/notification/notification.service';

@UntilDestroy()
@Component({
  selector: 'wen-space',
  templateUrl: './space.page.html',
  styleUrls: ['./space.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpacePage implements OnInit, OnDestroy {
  // Overview / Forum / Proposals / Awards / Treasury / Members
  public sections = [
    { route: 'overview', label: 'Overview' },
    { route: 'proposals', label: 'Proposals' },
    { route: 'awards', label: 'Awards' },
    { route: 'treasury', label: 'Treasury' },
    { route: 'members', label: 'Members' }
  ];
  private subscriptions$: Subscription[] = [];

  constructor(
    private auth: AuthService,
    private spaceApi: SpaceApi,
    private awardApi: AwardApi,
    private proposalApi: ProposalApi,
    private route: ActivatedRoute,
    private notification: NotificationService,
    private router: Router,
    public data: DataService,
    public nav: NavigationService
  ) {
    // none.
  }

  public ngOnInit(): void {
    this.route.params.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.space.space.replace(':', '')];
      if (id) {
        this.listenToSpace(id);
      } else {
        this.notFound();
      }
    });

    // If we're unable to find the space we take the user out as well.
    this.data.space$.pipe(skip(1)).subscribe((obj) => {
      if (!obj) {
        this.notFound();
      }
    });
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  private listenToSpace(id: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.spaceApi.listen(id).pipe(untilDestroyed(this)).subscribe(this.data.space$));
    this.listenToRelatedRecord(id);
    this.auth.member$.pipe(untilDestroyed(this)).subscribe((m?: Member) => {
      if (m?.uid) {
        this.listenToRelatedRecordWithMember(id, m.uid);
      } else {
        this.data.isMemberWithinSpace$.next(false);
        this.data.isGuardianWithinSpace$.next(false);
      }
    });
  }

  public get member$(): BehaviorSubject<Member|undefined> {
    return this.auth.member$;
  }

  private listenToRelatedRecord(spaceId: string): void {
    this.subscriptions$.push(this.spaceApi.listenGuardians(spaceId).pipe(untilDestroyed(this)).subscribe(this.data.guardians$));
    this.subscriptions$.push(this.spaceApi.listenMembers(spaceId).pipe(untilDestroyed(this)).subscribe(this.data.members$));
    this.subscriptions$.push(this.proposalApi.listenForSpace(spaceId, ProposalFilter.ACTIVE).pipe(untilDestroyed(this)).subscribe(this.data.proposalsActive$));
    this.subscriptions$.push(this.proposalApi.listenForSpace(spaceId, ProposalFilter.COMPLETED).pipe(untilDestroyed(this)).subscribe(this.data.proposalsCompleted$));
    this.subscriptions$.push(this.awardApi.listenForSpace(spaceId, AwardFilter.ACTIVE).pipe(untilDestroyed(this)).subscribe(this.data.awardsActive$));
    this.subscriptions$.push(this.awardApi.listenForSpace(spaceId, AwardFilter.COMPLETED).pipe(untilDestroyed(this)).subscribe(this.data.awardsCompleted$));
  }

  private listenToRelatedRecordWithMember(spaceId: string, memberId: string): void {
    this.subscriptions$.push(this.spaceApi.isMemberWithinSpace(spaceId, memberId).pipe(untilDestroyed(this)).subscribe(this.data.isMemberWithinSpace$));
    this.subscriptions$.push(this.spaceApi.isGuardianWithinSpace(spaceId, memberId).pipe(untilDestroyed(this)).subscribe(this.data.isGuardianWithinSpace$));
    this.subscriptions$.push(this.spaceApi.listenBlockedMembers(spaceId).pipe(untilDestroyed(this)).subscribe(this.data.blockedMembers$));
    this.subscriptions$.push(this.spaceApi.listenPendingMembers(spaceId).pipe(untilDestroyed(this)).subscribe(this.data.pendingMembers$));
  }

  public getAvatarUrl(url?: string): string | undefined {
    return url ? FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small) : undefined;
  }

  public getBannerUrl(url?: string): string | undefined {
    return url ? FileApi.getUrl(url, 'space_banner', FILE_SIZES.large) : undefined;
  }

  public get avatarUrl$(): Observable<string|undefined> {
    return this.data.space$.pipe(
      map((space: Space | undefined) => {
        return space?.avatarUrl ? FileApi.getUrl(space.avatarUrl, 'space_avatar', FILE_SIZES.small) : undefined;
      })
    );
  }

  public get bannerUrl$(): Observable<string|undefined> {
    return this.data.space$.pipe(
      map((space: Space | undefined) => {
        return space?.bannerUrl ? FileApi.getUrl(space.bannerUrl, 'space_banner', FILE_SIZES.large) : undefined;
      })
    );
  }

  public async join(): Promise<void> {
    if (!this.data.space$.value?.uid) {
      return;
    }

    await this.auth.sign({
      uid: this.data.space$.value.uid
    }, (sc, finish) => {
      this.notification.processRequest(this.spaceApi.join(sc), 'Joined.', finish).subscribe((val: any) => {
        // none.
      });
    });

  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public getMemberUrl(memberId: string): string[] {
    return ['/', ROUTER_UTILS.config.member.root, memberId];
  }

  public edit(): void {
    if (!this.data.space$.value?.uid) {
      return;
    }

    this.router.navigate([ROUTER_UTILS.config.space.root, ROUTER_UTILS.config.space.edit, {
      spaceId: this.data.space$.value.uid
    }]);
  }

  public async leave(): Promise<void> {
    if (!this.data.space$.value?.uid) {
      return;
    }

    await this.auth.sign({
      uid: this.data.space$.value.uid
    }, (sc, finish) => {
      this.notification.processRequest(this.spaceApi.leave(sc), 'Leaved.', finish).subscribe((val: any) => {
        // none
      });
    });

  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
