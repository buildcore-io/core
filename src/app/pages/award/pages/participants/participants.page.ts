import { Component } from '@angular/core';
import { DataService } from "../../services/data.service";
import { AwardApi } from './../../../../@api/award.api';
import { NotificationService } from './../../../../@core/services/notification/notification.service';
import { AuthService } from './../../../../components/auth/services/auth.service';

@Component({
  selector: 'wen-participants',
  templateUrl: './participants.page.html',
  styleUrls: ['./participants.page.less']
})
export class ParticipantsPage {
  constructor(
    private auth: AuthService,
    private awardApi: AwardApi,
    private notification: NotificationService,
    public data: DataService
  ) {
    // none.
  }

  public async approve(memberId: string): Promise<void> {
    const id: string | undefined = this.data.award$?.value?.uid;
    if (!id) {
      return;
    }

    await this.auth.sign({
      uid: id,
      member: memberId
    }, (sc, finish) => {
      this.notification.processRequest(this.awardApi.approve(sc), 'Approve.').subscribe((val: any) => {
        finish();
      });
    });

  }
}
