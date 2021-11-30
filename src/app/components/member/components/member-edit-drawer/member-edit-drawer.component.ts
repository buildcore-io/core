import { ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { AuthService } from '@components/auth/services/auth.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Member } from '../../../../../../functions/interfaces/models/member';
import { MemberApi } from '../../../../@api/member.api';
import { NotificationService } from '../../../../@core/services/notification/notification.service';
import { DISCORD_REGEXP, GITHUB_REGEXP, TWITTER_REGEXP } from './../../../../../../functions/interfaces/config';

@UntilDestroy()
@Component({
  selector: 'wen-member-edit-drawer',
  templateUrl: './member-edit-drawer.component.html',
  styleUrls: ['./member-edit-drawer.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberEditDrawerComponent implements OnInit {
  @Output() public wenOnClose = new EventEmitter<void>();
  public nameControl: FormControl = new FormControl('');
  public aboutControl: FormControl = new FormControl('');
  public discordControl: FormControl = new FormControl('', Validators.pattern(DISCORD_REGEXP));
  public twitterControl: FormControl = new FormControl('', Validators.pattern(TWITTER_REGEXP));
  public githubControl: FormControl = new FormControl('', Validators.pattern(GITHUB_REGEXP));
  public memberForm: FormGroup;

  // TODO minted logic
  minted = false;

  mint(): void {
    this.minted = true;
  }

  constructor(private auth: AuthService, private memberApi: MemberApi, private notification: NotificationService) {
    this.memberForm = new FormGroup({
      name: this.nameControl,
      about: this.aboutControl,
      discord: this.discordControl,
      twitter: this.twitterControl,
      github: this.githubControl
    });
  }

  public ngOnInit(): void {
    // Load default values.
    if (this.auth.member$.value) {
      this.setFormValues(this.auth.member$.value);
    }
    this.auth.member$.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (obj) {
        this.setFormValues(obj);
      }
    });
  }

  private setFormValues(obj: Member): void {
    this.nameControl.setValue(obj.name);
    this.aboutControl.setValue(obj.about);
    this.discordControl.setValue(obj.discord);
    this.twitterControl.setValue(obj.twitter);
    this.githubControl.setValue(obj.github);
  }

  public async save(): Promise<void> {
    this.memberForm.updateValueAndValidity();
    if (!this.memberForm.valid) {
      return;
    }


    await this.auth.sign({
      ...this.memberForm.value,
      ...{
        uid: this.auth.member$.value!.uid
      }
    }, (sc, finish) => {
      this.notification.processRequest(this.memberApi.updateMember(sc), 'Updated', finish).subscribe(() => {
        this.close();
      });
    });
  }

  public close(): void {
    this.wenOnClose.next();
  }
}
