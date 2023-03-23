import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '@components/auth/services/auth.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
  DISCORD_REGEXP,
  FILE_SIZES,
  GITHUB_REGEXP,
  Member,
  TWITTER_REGEXP,
} from '@soonaverse/interfaces';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { firstValueFrom } from 'rxjs';
import { MemberApi } from '../../../../@api/member.api';
import { NotificationService } from '../../../../@core/services/notification/notification.service';
import { MintApi } from './../../../../@api/mint.api';

const maxAboutCharacters = 160;

@UntilDestroy()
@Component({
  selector: 'wen-member-edit-drawer',
  templateUrl: './member-edit-drawer.component.html',
  styleUrls: ['./member-edit-drawer.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberEditDrawerComponent implements OnInit {
  @Input() isDesktop?: boolean;

  @Output() public wenOnClose = new EventEmitter<void>();
  public nameControl: FormControl = new FormControl('');
  public aboutControl: FormControl = new FormControl('', Validators.maxLength(maxAboutCharacters));
  public currentProfileImageControl: FormControl = new FormControl(undefined);
  public discordControl: FormControl = new FormControl('', Validators.pattern(DISCORD_REGEXP));
  public twitterControl: FormControl = new FormControl('', Validators.pattern(TWITTER_REGEXP));
  public githubControl: FormControl = new FormControl('', Validators.pattern(GITHUB_REGEXP));
  public minted = false;
  public maxAboutCharacters = maxAboutCharacters;
  public memberForm: FormGroup;

  constructor(
    private auth: AuthService,
    private memberApi: MemberApi,
    private mintApi: MintApi,
    private nzNotification: NzNotificationService,
    private notification: NotificationService,
    private cd: ChangeDetectorRef,
  ) {
    this.memberForm = new FormGroup({
      name: this.nameControl,
      about: this.aboutControl,
      currentProfileImage: this.currentProfileImageControl,
      discord: this.discordControl,
      twitter: this.twitterControl,
      github: this.githubControl,
    });
  }

  public ngOnInit(): void {
    // Load default values.
    if (this.auth.member$.value) {
      this.setFormValues(this.auth.member$.value);
    }
    this.auth.member$?.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (obj) {
        this.setFormValues(obj);
      }
    });
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public async mint(): Promise<void> {
    // Find Available image.
    const result = await firstValueFrom(this.mintApi.getAvailable('avatar'));
    if (!result || result?.length === 0) {
      this.nzNotification.error('', 'No more avatars available');
      return;
    } else {
      const results: boolean = await this.auth.mint();
      if (results === false) {
        this.nzNotification.error('', 'Unable to mint your avatar at the moment. Try again later.');
      } else {
        this.minted = true;
        this.currentProfileImageControl.setValue({
          metadata: result[0].uid,
          fileName: result[0].fileName,
          original: result[0].original,
          avatar: result[0].avatar,
        });
      }

      this.cd.markForCheck();
    }
  }

  private setFormValues(obj: Member): void {
    this.nameControl.setValue(obj.name);
    this.aboutControl.setValue(obj.about);
    this.discordControl.setValue(obj.discord);
    this.twitterControl.setValue(obj.twitter);
    this.githubControl.setValue(obj.github);
    this.currentProfileImageControl.setValue(obj.avatarNft);
  }

  public async save(): Promise<void> {
    this.memberForm.updateValueAndValidity();
    if (!this.memberForm.valid) {
      return;
    }

    const obj: any = this.memberForm.value;
    if (this.minted === false) {
      delete obj.currentProfileImage;
    }

    await this.auth.sign(
      {
        ...this.memberForm.value,
        ...{
          uid: this.auth.member$.value!.uid,
        },
      },
      (sc, finish) => {
        this.notification
          .processRequest(this.memberApi.updateMember(sc), 'Updated', finish)
          .subscribe(() => {
            this.close();
          });
      },
    );
  }

  public close(): void {
    this.wenOnClose.next();
  }
}
