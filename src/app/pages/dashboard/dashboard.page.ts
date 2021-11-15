import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Space } from "functions/interfaces/models";
import { BehaviorSubject, Subscription } from 'rxjs';
import { Proposal } from './../../../../functions/interfaces/models/proposal';
import { MemberApi } from './../../@api/member.api';

@UntilDestroy()
@Component({
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPage implements OnInit, OnDestroy {
  public spaces$: BehaviorSubject<Space[]> = new BehaviorSubject<Space[]>([]);
  public proposals$: BehaviorSubject<Proposal[]> = new BehaviorSubject<Proposal[]>([]);
  private subscriptions$: Subscription[] = [];
  path = ROUTER_UTILS.config.base;
  constructor(private auth: AuthService, private memberApi: MemberApi) {
    // none.
  }

  public ngOnInit(): void {
    this.auth.member$.pipe(untilDestroyed(this)).subscribe((o) => {
      this.cancelSubscriptions();
      if (o?.uid) {
        this.memberApi.lastSpaces(o.uid).pipe(untilDestroyed(this)).subscribe(this.spaces$);
      }
    });
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
