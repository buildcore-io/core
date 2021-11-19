import { Component } from '@angular/core';
import { undefinedToEmpty } from '@core/utils/manipulations.utils';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { DataService } from "../../services/data.service";
import { WenRequest } from './../../../../../../functions/interfaces/models/base';
import { AwardApi } from './../../../../@api/award.api';
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
    private notification: NzNotificationService,
    public data: DataService
  ) {
    // none.
  }

  public async approve(memberId: string): Promise<void> {
    const id: string | undefined = this.data.award$?.value?.uid;
    if (!id) {
      return;
    }

    const sc: WenRequest|undefined =  await this.auth.signWithMetamask(
      undefinedToEmpty({
        uid: id,
        member: memberId
      })
    );

    if (!sc) {
      throw new Error('Unable to sign.');
    }

    // TODO Handle this via queue and clean-up.
    this.awardApi.approve(sc).subscribe((o) => {
      this.notification.success('Approve.', '');
    });
  }

}
