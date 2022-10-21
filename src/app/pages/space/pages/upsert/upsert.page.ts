import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { SeoService } from '@core/services/seo';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Space } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzUploadChangeParam, NzUploadFile, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { first, Observable, of, Subscription } from 'rxjs';
import { FileApi } from '../../../../@api/file.api';
import { SpaceApi } from '../../../../@api/space.api';
import { NotificationService } from '../../../../@core/services/notification/notification.service';
import { GITHUB_REGEXP, TWITTER_REGEXP } from './../../../../../../functions/interfaces/config';
import { NavigationService } from './../../../../@core/services/navigation/navigation.service';

@UntilDestroy()
@Component({
  selector: 'wen-upsert',
  templateUrl: './upsert.page.html',
  styleUrls: ['./upsert.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpsertPage implements OnInit {
  public nameControl: FormControl = new FormControl('', Validators.required);
  public aboutControl: FormControl = new FormControl('', Validators.required);
  public openControl: FormControl = new FormControl(true);
  public discordControl: FormControl = new FormControl('', Validators.pattern(/^[a-zA-Z0-9_]*$/i));
  public twitterControl: FormControl = new FormControl('', Validators.pattern(TWITTER_REGEXP));
  public githubControl: FormControl = new FormControl('', Validators.pattern(GITHUB_REGEXP));
  public avatarControl: FormControl = new FormControl('', Validators.required);
  public bannerControl: FormControl = new FormControl('');
  public spaceForm: FormGroup;
  public editMode = false;
  public spaceId?: number;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private spaceApi: SpaceApi,
    private fileApi: FileApi,
    private notification: NotificationService,
    private nzNotification: NzNotificationService,
    private cd: ChangeDetectorRef,
    private seo: SeoService,
    public nav: NavigationService,
    public deviceService: DeviceService,
  ) {
    this.spaceForm = new FormGroup({
      name: this.nameControl,
      about: this.aboutControl,
      open: this.openControl,
      discord: this.discordControl,
      twitter: this.twitterControl,
      github: this.githubControl,
      avatarUrl: this.avatarControl,
      bannerUrl: this.bannerControl,
    });
  }

  public ngOnInit(): void {
    this.seo.setTags(
      $localize`Space - New`,
      $localize`Sign up in minutes with our 1-click set up DAO-on-Demand. Fee-less on chain voting, Discover all of the amazing DAO's on the Soonaverse.`,
    );

    this.route.params?.pipe(untilDestroyed(this)).subscribe((o) => {
      if (o?.spaceId) {
        this.editMode = true;
        this.spaceId = o.spaceId;
        this.spaceApi.listen(o.spaceId).pipe(first()).subscribe((o) => {
          if (!o) {
            // Unable to find the space. Take them back.
            this.nav.goBack();
          } else {
            this.nameControl.setValue(o.name);
            this.aboutControl.setValue(o.about);
            this.openControl.setValue(o.open === true);
            this.discordControl.setValue(o.discord);
            this.twitterControl.setValue(o.twitter);
            this.githubControl.setValue(o.github);
            this.avatarControl.setValue(o.avatarUrl);
            this.bannerControl.setValue(o.bannerUrl);
            this.cd.markForCheck();
          }
        });
      }
    });
  }

  public uploadChangeAvatar(event: NzUploadChangeParam): void {
    this.uploadChange('space_avatar', event);
  }

  public uploadChangeBanner(event: NzUploadChangeParam): void {
    this.uploadChange('space_banner', event);
  }

  private uploadChange(type: 'space_avatar' | 'space_banner', event: NzUploadChangeParam): void {
    if (event.type === 'success') {
      if (type === 'space_avatar') {
        this.avatarControl.setValue(event.file.response);
      } else if (type === 'space_banner') {
        this.bannerControl.setValue(event.file.response);
      }
    }
  }

  public uploadFile(type: 'space_avatar' | 'space_banner', item: NzUploadXHRArgs): Subscription {
    if (!this.auth.member$.value) {
      const err = $localize`Member seems to log out during the file upload request.`;
      this.nzNotification.error(err, '');
      if (item.onError) {
        item.onError(err, item.file);
      }

      return of().subscribe();
    }

    return this.fileApi.upload(this.auth.member$.value.uid, item, type);
  }

  private validateForm(): boolean {
    this.spaceForm.updateValueAndValidity();
    if (!this.spaceForm.valid) {
      Object.values(this.spaceForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      return false;
    }

    return true;
  }

  public previewFile(file: NzUploadFile): Observable<string> {
    return of(file.response);
  };


  public async create(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }
    await this.auth.sign(this.spaceForm.value, (sc, finish) => {
      this.notification.processRequest(this.spaceApi.create(sc), 'Created.', finish).subscribe((val: Space | undefined) => {
        this.router.navigate([ROUTER_UTILS.config.space.root, val?.uid]);
      });
    });
  }

  public async save(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }
    await this.auth.sign({
      ...this.spaceForm.value,
      ...{
        uid: this.spaceId,
      },
    }, (sc, finish) => {
      this.notification.processRequest(this.spaceApi.save(sc), 'Saved.', finish).subscribe((val: Space | undefined) => {
        this.router.navigate([ROUTER_UTILS.config.space.root, val?.uid]);
      });
    });
  }

  public getAvatarCardDescription(): string {
    return this.editMode ? $localize`Upload new to replace existing.` : $localize`Your brand is key.`;
  }

  public getBannerCardDescription(): string {
    return this.editMode ? $localize`Upload new to replace existing.` : $localize`Make it personal.`;
  }
}
