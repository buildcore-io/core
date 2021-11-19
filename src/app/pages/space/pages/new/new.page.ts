import { Location } from "@angular/common";
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { getUrlValidator } from '@core/utils/form-validation.utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzUploadChangeParam, NzUploadXHRArgs } from "ng-zorro-antd/upload";
import { of, Subscription } from 'rxjs';
import { WenRequest } from './../../../../../../functions/interfaces/models/base';
import { FileApi } from './../../../../@api/file.api';
import { SpaceApi } from './../../../../@api/space.api';

@Component({
  selector: 'wen-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewPage {
  public nameControl: FormControl = new FormControl('');
  public aboutControl: FormControl = new FormControl('');
  public discordControl: FormControl = new FormControl('', getUrlValidator());
  public twitterControl: FormControl = new FormControl('', getUrlValidator());
  public githubControl: FormControl = new FormControl('', getUrlValidator());
  public avatarControl: FormControl = new FormControl('');
  public bannerControl: FormControl = new FormControl('');
  public spaceForm: FormGroup;

  constructor(
    private auth: AuthService,
    private location: Location,
    private router: Router,
    private spaceApi: SpaceApi,
    private fileApi: FileApi,
    private notification: NzNotificationService
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
      this.notification.error(err, '');
      if (item.onError) {
        item.onError(err, item.file);
      }

      return of().subscribe();
    }

    return this.fileApi.upload(this.auth.member$.value.uid, item, 'space_avatar');
  }

  public goBack(): void {
    this.location.back();
  }

  public async create(): Promise<void> {
    this.spaceForm.updateValueAndValidity();
    if (!this.spaceForm.valid) {
      return;
    }
    const sc: WenRequest|undefined =  await this.auth.sign(this.spaceForm.value);

    // TODO Handle this via queue and clean-up.
    this.spaceApi.create(sc).subscribe((val) => {
      this.notification.success('Created.', '');
      this.router.navigate([ROUTER_UTILS.config.space.root, val?.uid])
    });
  }
}
