import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { getUrlValidator } from '@core/utils/form-validation.utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzUploadChangeParam, NzUploadXHRArgs } from "ng-zorro-antd/upload";
import { first, of, Subscription } from 'rxjs';
import { FileApi } from '../../../../@api/file.api';
import { SpaceApi } from '../../../../@api/space.api';
import { NotificationService } from '../../../../@core/services/notification/notification.service';
import { NavigationService } from './../../../../@core/services/navigation/navigation.service';

@UntilDestroy()
@Component({
  selector: 'wen-upsert',
  templateUrl: './upsert.page.html',
  styleUrls: ['./upsert.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpsertPage implements OnInit {
  public nameControl: FormControl = new FormControl('');
  public aboutControl: FormControl = new FormControl('');
  public discordControl: FormControl = new FormControl('', getUrlValidator());
  public twitterControl: FormControl = new FormControl('', getUrlValidator());
  public githubControl: FormControl = new FormControl('', getUrlValidator());
  public avatarControl: FormControl = new FormControl('');
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
    public nav: NavigationService
  ) {
    this.spaceForm = new FormGroup({
      name: this.nameControl,
      about: this.aboutControl,
      discord: this.discordControl,
      twitter: this.twitterControl,
      github: this.githubControl,
      avatarUrl: this.avatarControl,
      bannerUrl: this.bannerControl
    });
  }

  public ngOnInit(): void {
    this.route.params.pipe(untilDestroyed(this)).subscribe((o) => {
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

  private uploadChange(type: 'space_avatar'|'space_banner', event: NzUploadChangeParam): void {
    if (event.type === 'success') {
      if (type === 'space_avatar') {
        this.avatarControl.setValue(event.file.response);
      } else if (type === 'space_banner') {
        this.bannerControl.setValue(event.file.response);
      }
    }
  }

  public uploadFile(item: NzUploadXHRArgs): Subscription {
    if (!this.auth.member$.value) {
      const err = 'Member seems to log out during the file upload request.';
      this.nzNotification.error(err, '');
      if (item.onError) {
        item.onError(err, item.file);
      }

      return of().subscribe();
    }

    return this.fileApi.upload(this.auth.member$.value.uid, item, 'space_avatar');
  }

  public async create(): Promise<void> {
    this.spaceForm.updateValueAndValidity();
    if (!this.spaceForm.valid) {
      return;
    }
    await this.auth.sign(this.spaceForm.value, (sc, finish) => {
      this.notification.processRequest(this.spaceApi.create(sc), 'Created.').subscribe((val: any) => {
        finish();
        this.router.navigate([ROUTER_UTILS.config.space.root, val?.uid]);
      });
    });
  }

  public async save(): Promise<void> {
    this.spaceForm.updateValueAndValidity();
    if (!this.spaceForm.valid) {
      return;
    }
    await this.auth.sign({
      ...this.spaceForm.value,
      ...{
        uid: this.spaceId
      }
    }, (sc, finish) => {
      this.notification.processRequest(this.spaceApi.save(sc), 'Saved.').subscribe((val: any) => {
        finish();
        this.router.navigate([ROUTER_UTILS.config.space.root, val?.uid]);
      });
    });
  }
}
