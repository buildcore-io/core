import { Location } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FileApi, FILE_SIZES } from "@api/file.api";
import { AuthService } from '@components/auth/services/auth.service';
import { undefinedToEmpty } from '@core/utils/manipulations.utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Space } from "functions/interfaces/models";
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';
import { WenRequest } from './../../../../../../functions/interfaces/models/base';
import { Member } from './../../../../../../functions/interfaces/models/member';
import { SpaceGuardian } from './../../../../../../functions/interfaces/models/space';
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
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public isMemberWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public guardians$: BehaviorSubject<SpaceGuardian[]|undefined> = new BehaviorSubject<SpaceGuardian[]|undefined>(undefined);
  private subscriptions$: Subscription[] = [];

  constructor(
    private auth: AuthService,
    private location: Location,
    private spaceApi: SpaceApi,
    private route: ActivatedRoute,
    private notification: NzNotificationService,
    private router: Router
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
    this.space$.pipe(skip(1)).subscribe((obj) => {
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
    this.subscriptions$.push(this.spaceApi.listen(id).pipe(untilDestroyed(this)).subscribe(this.space$));
    this.auth.member$.pipe(untilDestroyed(this)).subscribe((m?: Member) => {
      if (m?.uid) {
        this.listenToIsMemberAndGuardian(id, m.uid);
      }
    });
  }

  public get member$(): BehaviorSubject<Member|undefined> {
    return this.auth.member$;
  }

  private listenToIsMemberAndGuardian(spaceId: string, memberId: string): void {
    this.subscriptions$.push(this.spaceApi.isMemberWithinSpace(spaceId, memberId).pipe(untilDestroyed(this)).subscribe(this.isMemberWithinSpace$));
    this.subscriptions$.push(this.spaceApi.isGuardianWithinSpace(spaceId, memberId).pipe(untilDestroyed(this)).subscribe(this.isGuardianWithinSpace$));
    this.subscriptions$.push(this.spaceApi.listenGuardians(spaceId).pipe(untilDestroyed(this)).subscribe(this.guardians$));
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
    return this.space$.pipe(
      map((space: Space | undefined) => {
        return space?.avatarUrl ? FileApi.getUrl(space.avatarUrl, 'space_avatar', FILE_SIZES.small) : undefined;
      })
    );
  }

  public get bannerUrl$(): Observable<string|undefined> {
    return this.space$.pipe(
      map((space: Space | undefined) => {
        return space?.bannerUrl ? FileApi.getUrl(space.bannerUrl, 'space_banner', FILE_SIZES.large) : undefined;
      })
    );
  }

  public async join(): Promise<void> {
    if (!this.space$.value?.uid) {
      return;
    }

    const sc: WenRequest|undefined =  await this.auth.signWithMetamask(
      undefinedToEmpty({
        uid: this.space$.value.uid
      })
    );

    if (!sc) {
      throw new Error('Unable to sign.');
    }

    // TODO Handle this via queue and clean-up.
    this.spaceApi.join(sc).subscribe(() => {
      this.notification.success('Joined.', '');
    });
  }

  public async leave(): Promise<void> {
    if (!this.space$.value?.uid) {
      return;
    }

    const sc: WenRequest|undefined =  await this.auth.signWithMetamask(
      undefinedToEmpty({
        uid: this.space$.value.uid
      })
    );

    if (!sc) {
      throw new Error('Unable to sign.');
    }

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
