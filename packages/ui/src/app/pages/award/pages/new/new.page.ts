import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SpaceApi } from '@api/space.api';
import { TokenApi } from '@api/token.api';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { SeoService } from '@core/services/seo';
import { UnitsService } from '@core/services/units';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { environment } from '@env/environment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AwardBadgeType, FILE_SIZES, Space, Token } from '@soonaverse/interfaces';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, firstValueFrom, Subscription, switchMap } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { AwardApi } from './../../../../@api/award.api';
import { MemberApi } from './../../../../@api/member.api';
import { MintApi } from './../../../../@api/mint.api';
import { NavigationService } from './../../../../@core/services/navigation/navigation.service';
import { NotificationService } from './../../../../@core/services/notification/notification.service';
import { AuthService } from './../../../../components/auth/services/auth.service';

import { Network } from '@soonaverse/interfaces';

@UntilDestroy()
@Component({
  selector: 'wen-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.less'],
})
export class NewPage implements OnInit, OnDestroy {
  public tokenControl: FormControl = new FormControl('', Validators.required);
  public spaceControl: FormControl = new FormControl('', Validators.required);
  public nameControl: FormControl = new FormControl('', Validators.required);
  public endControl: FormControl = new FormControl('', Validators.required);
  public descriptionControl: FormControl = new FormControl('');
  public imageControl: FormControl = new FormControl(undefined);
  // Badge
  public badgeDescriptionControl: FormControl = new FormControl('');
  public badgeNameControl: FormControl = new FormControl('', Validators.required);
  public badgeTokenControl: FormControl = new FormControl('', [
    Validators.min(0),
    Validators.max(10000),
    Validators.required,
  ]);
  public badgeCountControl: FormControl = new FormControl('', [
    Validators.min(0),
    Validators.max(10000),
    Validators.required,
  ]);

  public awardForm: FormGroup;
  public spaces$: BehaviorSubject<Space[]> = new BehaviorSubject<Space[]>([]);
  public tokens$: BehaviorSubject<Token[]> = new BehaviorSubject<Token[]>([]);
  private subscriptions$: Subscription[] = [];

  constructor(
    private auth: AuthService,
    private awardApi: AwardApi,
    private tokenApi: TokenApi,
    private nzNotification: NzNotificationService,
    private notification: NotificationService,
    private memberApi: MemberApi,
    private route: ActivatedRoute,
    private router: Router,
    private mintApi: MintApi,
    private cd: ChangeDetectorRef,
    private seo: SeoService,
    private spaceApi: SpaceApi,
    public unitsService: UnitsService,
    public nav: NavigationService,
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
  ) {
    this.awardForm = new FormGroup({
      space: this.spaceControl,
      name: this.nameControl,
      endDate: this.endControl,
      description: this.descriptionControl,
      badgeDescription: this.badgeDescriptionControl,
      badgeName: this.badgeNameControl,
      badgeToken: this.badgeTokenControl,
      badgeCount: this.badgeCountControl,
      image: this.imageControl,
      token: this.tokenControl,
    });
  }

  public ngOnInit(): void {
    if (
      this.nav.getLastUrl() &&
      this.nav.getLastUrl()[1] === ROUTER_UTILS.config.space.root &&
      this.nav.getLastUrl()[2]
    ) {
      this.spaceControl.setValue(this.nav.getLastUrl()[2]);
    }

    this.seo.setTags(
      $localize`Award - New`,
      $localize`Create engagement and growth for your DAOs and digital communities. Awards, fee-less voting, 1-click set up. Join today.`,
    );

    this.route.params
      ?.pipe(
        filter((p) => p.space),
        switchMap((p) => this.spaceApi.listen(p.space)),
        filter((space) => !!space),
        untilDestroyed(this),
      )
      .subscribe((space) => {
        this.spaceControl.setValue(space?.uid);

        this.seo.setTags(
          $localize`Award - New`,
          $localize`Create engagement and growth for your DAOs and digital communities. Awards, fee-less voting, 1-click set up. Join today.`,
          space?.bannerUrl,
        );
      });

    this.auth.member$?.pipe(untilDestroyed(this)).subscribe((o) => {
      if (o?.uid) {
        this.subscriptions$.push(this.memberApi.allSpacesAsMember(o.uid).subscribe(this.spaces$));
      }
    });

    this.subscriptions$.push(
      this.tokenApi
        .top()
        .pipe(
          map((tokens) => {
            return tokens?.filter((t) => {
              return (
                <any>t.mintingData?.network === (environment.production ? Network.SMR : Network.RMS)
              );
            });
          }),
        )
        .subscribe(this.tokens$),
    );
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public getTotalTokens(): number {
    return Number(this.badgeCountControl.value) * Number(this.badgeTokenControl.value);
  }

  public getCurrentToken(): Token | undefined {
    return this.tokens$.value.find((t) => {
      return this.tokenControl.value === t.uid;
    });
  }

  private formatSubmitObj(obj: any): any {
    obj.badge = {
      description: obj.badgeDescription,
      name: obj.badgeName,
      tokenReward: obj.badgeToken * 1000 * 1000,
      total: obj.badgeCount,
      image:
        'https://images-wen.soonaverse.com/0x551fd2c7c7bf356bac194587dab2fcd46420054b/amzoylrqy1g/nft_placeholder.jpeg',
      type: AwardBadgeType.NATIVE,
      tokenSymbol: this.getCurrentToken()?.symbol,
    };

    obj.network = environment.production ? Network.SMR : Network.RMS;
    delete obj.image;
    delete obj.badgeDescription;
    delete obj.badgeName;
    delete obj.badgeToken;
    delete obj.badgeCount;
    delete obj.token;
    return obj;
  }

  private validateForm(): boolean {
    this.awardForm.updateValueAndValidity();
    if (!this.awardForm.valid) {
      Object.values(this.awardForm.controls).forEach((control) => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      return false;
    }

    return true;
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public async create(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    if (!this.imageControl.value && !(await this.mint())) {
      return;
    }

    await this.auth.sign(this.formatSubmitObj(this.awardForm.value), (sc, finish) => {
      this.notification
        .processRequest(this.awardApi.create(sc), 'Created.', finish)
        .subscribe((val) => {
          this.router.navigate([ROUTER_UTILS.config.award.root, val?.uid]);
        });
    });
  }

  public async mint(): Promise<boolean> {
    // Find Available image.
    const result = await firstValueFrom(this.mintApi.getAvailable('badge'));
    if (!result || result?.length === 0) {
      this.nzNotification.error('', 'No more avatars available');
      return false;
    } else {
      const results: boolean = await this.auth.mint();
      if (results === false) {
        this.nzNotification.error('', 'Unable to mint your badge at the moment. Try again later.');
        return false;
      } else {
        this.imageControl.setValue({
          metadata: result[0].uid,
          fileName: result[0].fileName,
          original: result[0].original,
          avatar: result[0].avatar,
        });

        this.cd.markForCheck();
        return true;
      }
    }
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
