import { Location } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FileApi, FILE_SIZES } from "@api/file.api";
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from "@pages/space/services/data.service";
import { Space } from "functions/interfaces/models";
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';
import { WenRequest } from './../../../../../../functions/interfaces/models/base';
import { Member } from './../../../../../../functions/interfaces/models/member';
import { AwardApi } from './../../../../@api/award.api';
import { ProposalApi } from './../../../../@api/proposal.api';
import { SpaceApi } from './../../../../@api/space.api';

@UntilDestroy()
@Component({
  selector: 'wen-space',
  templateUrl: './space.page.html',
  styleUrls: ['./space.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpacePage implements OnInit, OnDestroy {
  public sections = [
    { route: 'overview', label: 'Overview' },
    { route: 'proposals', label: 'Proposals' },
    { route: 'awards', label: 'Awards' },
    { route: 'funding', label: 'Funding' },
    { route: 'members', label: 'Members' }
  ];
  private subscriptions$: Subscription[] = [];

  constructor(
    private auth: AuthService,
    private location: Location,
    private spaceApi: SpaceApi,
    private awardApi: AwardApi,
    private proposalApi: ProposalApi,
    private route: ActivatedRoute,
    private notification: NzNotificationService,
    private router: Router,
    public data: DataService
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
    this.auth.member$.pipe(untilDestroyed(this)).subscribe((m?: Member) => {
      if (m?.uid) {
        this.listenToRelatedRecord(id, m.uid);
      }
    });
  }

  public get member$(): BehaviorSubject<Member|undefined> {
    return this.auth.member$;
  }

  private listenToRelatedRecord(spaceId: string, memberId: string): void {
    this.subscriptions$.push(this.spaceApi.listenGuardians(spaceId).pipe(untilDestroyed(this)).subscribe(this.data.guardians$));
    this.subscriptions$.push(this.spaceApi.listenMembers(spaceId).pipe(untilDestroyed(this)).subscribe(this.data.members$));
    this.subscriptions$.push(this.spaceApi.isMemberWithinSpace(spaceId, memberId).pipe(untilDestroyed(this)).subscribe(this.data.isMemberWithinSpace$));
    this.subscriptions$.push(this.spaceApi.isGuardianWithinSpace(spaceId, memberId).pipe(untilDestroyed(this)).subscribe(this.data.isGuardianWithinSpace$));
    this.subscriptions$.push(this.proposalApi.listenForSpace(spaceId).pipe(untilDestroyed(this)).subscribe(this.data.proposals$));
    this.subscriptions$.push(this.awardApi.listenForSpace(spaceId).pipe(untilDestroyed(this)).subscribe(this.data.awards$));
  }

  public getAvatarUrl(url?: string): string | undefined {
    return url ? FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small) : undefined;
  }

  public goBack(): void {
    this.location.back();
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

    const sc: WenRequest|undefined =  await this.auth.sign({
      uid: this.data.space$.value.uid
    });

    // TODO Handle this via queue and clean-up.
    this.spaceApi.join(sc).subscribe(() => {
      this.notification.success('Joined.', '');
    });
  }

  public async leave(): Promise<void> {
    if (!this.data.space$.value?.uid) {
      return;
    }

    const sc: WenRequest|undefined =  await this.auth.sign({
      uid: this.data.space$.value.uid
    });

    // TODO Handle this via queue and clean-up.
    this.spaceApi.leave(sc).subscribe(() => {
      this.notification.success('Leaved.', '');
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
