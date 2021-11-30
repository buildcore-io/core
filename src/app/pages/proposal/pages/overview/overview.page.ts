import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { AuthService } from '@components/auth/services/auth.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { ProposalApi } from './../../../../@api/proposal.api';
import { NotificationService } from './../../../../@core/services/notification/notification.service';
import { DataService } from './../../services/data.service';

@UntilDestroy()
@Component({
  selector: 'wen-overview',
  templateUrl: './overview.page.html',
  styleUrls: ['./overview.page.less']
})
export class OverviewPage implements OnInit {
  public voteControl: FormControl = new FormControl();
  constructor(
    private auth: AuthService,
    private notification: NotificationService,
    private nzNotification: NzNotificationService,
    private proposalApi: ProposalApi,
    public data: DataService
  ) {
    // none.
  }

  public ngOnInit(): void {
    this.data.currentMembersVotes$.pipe(untilDestroyed(this)).subscribe((tran) => {
      if (tran?.[0]?.payload?.values?.length > 0) {
        // TODO Deal with multiple answers.
        tran?.[0]?.payload?.values.forEach((v: number) => {
          this.voteControl.setValue(v);
        });
      }
    });
  }

  public async vote(): Promise<void> {
    if (!this.data.proposal$.value?.uid) {
      return;
    }

    if (!(this.voteControl.value > 0)) {
      this.nzNotification.error('', 'Please select option first!');
      return;
    }

    await this.auth.sign({
      uid: this.data.proposal$.value.uid,
      values: [this.voteControl.value]
    }, (sc, finish) => {
      this.notification.processRequest(this.proposalApi.vote(sc), 'Voted.', finish).subscribe((val: any) => {
        // none.
      });
    });
  }
}
