import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AllocationType, NewService } from '@pages/token/services/new.service';
import { StepType } from '../new.page';

@UntilDestroy()
@Component({
  selector: 'wen-new-metrics',
  templateUrl: './metrics.component.html',
  styleUrls: ['./metrics.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewMetricsComponent implements OnInit {
  @Output() wenOnTabChange = new EventEmitter<StepType>();

  public isTotalValid = true;

  constructor(
    public newService: NewService,
    public deviceService: DeviceService,
    private cd: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    this.newService.allocations?.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe((allocations: AllocationType[]) => {
        const total = allocations.reduce((acc, act) => acc + Number(act.percentage), 0)
        this.isTotalValid = total === 100;
        this.cd.markForCheck();
      });
  }
  
  public get stepTypes(): typeof StepType {
    return StepType;
  }

  public getAllocationTitle(index: number): string {
    return index === 1 ? $localize`Token allocation` : ($localize`Allocation` + ` #${index >= 10 ? index : '0' + index}`);
  }

  public getAllocationDescription(index: number): string {
    return index === 1 ?
      $localize`Please make sure that there is one allocation market as Public Sale as this could be later sold on Soonaverse. 
        ou can initiate Public sale once the token is created and approved.` : '';
  }
}
