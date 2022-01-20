import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, Router } from '@angular/router';
import { FileApi } from "@api/file.api";
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from "@pages/space/services/data.service";
import { Space } from "functions/interfaces/models";
import { BehaviorSubject, map, Observable, skip } from 'rxjs';
import { WEN_NAME } from './../../../../../../functions/interfaces/config';
import { FILE_SIZES } from "./../../../../../../functions/interfaces/models/base";
import { Member } from './../../../../../../functions/interfaces/models/member';
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
  public isAboutSpaceVisible = false;

  constructor(
    private titleService: Title,
    private auth: AuthService,
    private spaceApi: SpaceApi,
    private route: ActivatedRoute,
    private notification: NotificationService,
    private router: Router,
    public data: DataService,
    public nav: NavigationService,
    public deviceService: DeviceService
  ) {
    // none.
  }

  public ngOnInit(): void {
    this.titleService.setTitle(WEN_NAME + ' - ' + 'Space');
    this.route.params.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.space.space.replace(':', '')];
      if (id) {
        this.data.listenToSpace(id);
      } else {
        this.notFound();
      }
    });

    // If we're unable to find the space we take the user out as well.
    this.data.space$.pipe(skip(1), untilDestroyed(this)).subscribe((obj) => {
      if (!obj) {
        this.notFound();
      }
    });
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  public get member$(): BehaviorSubject<Member|undefined> {
    return this.auth.member$;
  }

  public getAvatarUrl(url?: string): string | undefined {
    return url ? FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small) : undefined;
  }

  public getBannerUrl(url?: string): string | undefined {
    return url ? FileApi.getUrl(url, 'space_banner', FILE_SIZES.large) : undefined;
  }

  public get urlToNewSpace(): string {
    return '/' + ROUTER_UTILS.config.space.root + '/new';
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

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public async join(): Promise<void> {
    if (!this.data.space$.value?.uid) {
      return;
    }

    await this.auth.sign({
      uid: this.data.space$.value.uid
    }, (sc, finish) => {
      this.notification.processRequest(
        this.spaceApi.join(sc), this.data.space$.value?.open ? 'Joined.' : 'Pending Approval', finish
      ).subscribe((val: any) => {
        // none.
      });
    });

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

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
    this.data.cancelSubscriptions();
  }
}
