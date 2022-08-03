import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { MilestoneApi } from '@api/milestone.api';
import { MilestoneAtoiApi } from '@api/milestone_atoi.api';
import { MilestoneRmsApi } from '@api/milestone_rms.api';
import { DeviceService } from '@core/services/device';
import { environment } from '@env/environment';
import { Milestone } from '@functions/interfaces/models/milestone';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, map } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-network-status',
  templateUrl: './network-status.component.html',
  styleUrls: ['./network-status.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NetworkStatusComponent implements OnInit {
  public isVisible = false;
  public environment = environment;
  public lastIotaMilestone$ = new BehaviorSubject<Milestone|undefined>(undefined);
  public lastAtoiMilestone$ = new BehaviorSubject<Milestone|undefined>(undefined);
  public lastRmsMilestone$ = new BehaviorSubject<Milestone|undefined>(undefined);

  constructor(
    public deviceService: DeviceService,
    private milestoneApi: MilestoneApi,
    private milestoneRmsApi: MilestoneRmsApi,
    private milestonreAtoiApi: MilestoneAtoiApi
  ) {}

  public ngOnInit(): void {
    this.milestoneApi.top(undefined, undefined, 1)?.pipe(untilDestroyed(this), map((o: Milestone[]) => {
      return o[0];
    })).subscribe(this.lastIotaMilestone$);

    this.milestoneRmsApi.top(undefined, undefined, 1)?.pipe(untilDestroyed(this), map((o: Milestone[]) => {
      return o[0];
    })).subscribe(this.lastRmsMilestone$);

    this.milestonreAtoiApi.top(undefined, undefined, 1)?.pipe(untilDestroyed(this), map((o: Milestone[]) => {
      return o[0];
    })).subscribe(this.lastAtoiMilestone$);
  }
}
