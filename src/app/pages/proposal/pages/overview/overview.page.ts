import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as dayjs from 'dayjs';
import { Timestamp } from "functions/interfaces/models/base";
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, interval, Subscription } from "rxjs";
import { Proposal } from './../../../../../../functions/interfaces/models/proposal';
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
  public startDateTicker$: BehaviorSubject<Timestamp>;
  constructor(
    private auth: AuthService,
    private notification: NotificationService,
    private nzNotification: NzNotificationService,
    private proposalApi: ProposalApi,
    public data: DataService,
    public deviceService: DeviceService
  ) {
    // Init start date.
    this.startDateTicker$ = new BehaviorSubject<Timestamp>(this.data.proposal$.value?.settings?.startDate);
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

    this.data.proposal$.pipe(untilDestroyed(this)).subscribe((p) => {
      this.startDateTicker$.next(p?.settings?.startDate);
    });

    // Run ticker.
    const int: Subscription = interval(1000).pipe(untilDestroyed(this)).subscribe(() => {
      this.startDateTicker$.next(this.startDateTicker$.value);

      // If it's in the past.
      if (this.startDateTicker$.value && dayjs(this.startDateTicker$.value.toDate()).isBefore(dayjs())) {
        int.unsubscribe();
        this.data.proposal$.next(<Proposal>{...this.data.proposal$.value});
      }
    });
  }

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
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
