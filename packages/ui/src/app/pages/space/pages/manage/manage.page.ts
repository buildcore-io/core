import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { DataService, SpaceAction } from '@pages/space/services/data.service';
import { Subscription } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-manage',
  templateUrl: './manage.page.html',
  styleUrls: ['./manage.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagePage implements OnDestroy {
  private subscriptions$: Subscription[] = [];

  constructor(public data: DataService) {}

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public manageAddresses(): void {
    this.data.triggerAction$.next(SpaceAction.MANAGE_ADDRESSES);
  }

  public exportCurrentMembers(): void {
    this.data.triggerAction$.next(SpaceAction.EXPORT_CURRENT_MEMBERS);
  }

  public stakingRewardSchedule(): void {
    this.data.triggerAction$.next(SpaceAction.STAKING_REWARD_SCHEDULE);
  }

  public exportCurrentStakers(): void {
    this.data.triggerAction$.next(SpaceAction.EXPORT_CURRENT_STAKERS);
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
