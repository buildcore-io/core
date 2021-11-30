import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { AuthService } from '@components/auth/services/auth.service';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { ProposalApi } from './../../../../@api/proposal.api';
import { NotificationService } from './../../../../@core/services/notification/notification.service';
import { DataService } from './../../services/data.service';

@Component({
  selector: 'wen-overview',
  templateUrl: './overview.page.html',
  styleUrls: ['./overview.page.less']
})
export class OverviewPage {
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
