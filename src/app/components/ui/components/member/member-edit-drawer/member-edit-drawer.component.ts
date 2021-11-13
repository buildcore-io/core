import { ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormControl, FormGroup } from "@angular/forms";
import { AuthService } from '@components/auth/services/auth.service';
import { getUrlValidator } from "@core/utils/form-validation.utils";
import { undefinedToEmpty } from "@core/utils/manipulations.utils";
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Member } from './../../../../../../../functions/interfaces/models/member';
import { MemberApi } from './../../../../../@api/member.api';
import { MetamaskSignature } from './../../../../auth/services/auth.service';

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
  public linkedinControl: FormControl = new FormControl('', getUrlValidator());
  public twitterControl: FormControl = new FormControl('', getUrlValidator());
  public githubControl: FormControl = new FormControl('', getUrlValidator());
  public memberForm: FormGroup;

  constructor(private auth: AuthService, private memberApi: MemberApi, private notification: NzNotificationService) {
    this.memberForm = new FormGroup({
      name: this.nameControl,
      about: this.aboutControl,
      linkedin: this.linkedinControl,
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
    this.linkedinControl.setValue(obj.linkedin);
    this.twitterControl.setValue(obj.twitter);
    this.githubControl.setValue(obj.github);
  }

  public async save(): Promise<void> {
    this.memberForm.updateValueAndValidity();
    if (!this.memberForm.valid) {
      return;
    }

    const sc: MetamaskSignature|undefined =  await this.auth.signWithMetamask(undefinedToEmpty({
      ...this.memberForm.value,
      ...{
        uid: this.auth.member$.value!.uid
      }
    }));
    if (!sc) {
      throw new Error('Unable to sign.');
    }

    // TODO Handle this via queue and clean-up.
    this.memberApi.updateMember(sc.token).subscribe(() => {
      this.notification.success('Updated.', '');
    });

    this.close();
  }

  public close(): void {
    this.wenOnClose.next();
  }
}
