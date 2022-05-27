import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { DescriptionItem } from '@components/description/description.component';
import { DeviceService } from '@core/services/device';
import { Token, TokenAllocation } from '@functions/interfaces/models/token';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/token/services/data.service';
import { NewService } from '@pages/token/services/new.service';
import { merge } from 'rxjs';
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
  public isPublicSaleValid = true;
  public breakdownData: DescriptionItem[] = [];

  constructor(
    public newService: NewService,
    public deviceService: DeviceService,
    public data: DataService,
    private cd: ChangeDetectorRef,
    private decimalPipe: DecimalPipe
  ) {}

  public ngOnInit(): void {
    this.newService.allocations?.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe((allocations: TokenAllocation[]) => {
        const total = allocations.reduce((acc, act) => acc + Number(act.percentage), 0)
        const publicSales = allocations.filter((a) => a.isPublicSale);
        this.isTotalValid = total === 100;
        this.isPublicSaleValid = publicSales.length <= 1;
        this.cd.markForCheck();
      });

    merge(
      this.newService.allocations?.valueChanges,
      this.newService.priceControl?.valueChanges,
      this.newService.totalSupplyControl?.valueChanges
    ).pipe(untilDestroyed(this))
      .subscribe(() => {
        this.setBreakdownData();
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
      $localize`Please make sure that there is only one allocation marked for public sale as this could be later sold on Soonaverse.
        You can initiate a public sale once the token is created and approved.` : '';
  }

  private setBreakdownData(): void {
    if (!this.newService.allocations.value?.length || !this.newService.totalSupplyControl?.value || !this.newService.priceControl?.value) {
      this.breakdownData = [];
    } else {
      this.breakdownData = [
        { title: $localize`Total token supply`, value: this.decimalPipe.transform(this.data.formatTokenBest(Number(this.newService.totalSupplyControl?.value) * 1000 * 1000), '1.0-2') },
        { title: $localize`Price per token`, value: (this.newService.priceControl?.value || 0) + ' Mi'},
        ...(this.newService.allocations.value || [])
          .filter((a: TokenAllocation) => a.title && a.percentage)
          .map((a: TokenAllocation) =>
            ({ title: a.title, value: a.percentage + '%', extraValue: `(${this.data.percentageMarketCap(a.percentage, { pricePerToken: Number(this.newService.priceControl?.value) * 1000 * 1000, totalSupply: this.newService.totalSupplyControl?.value } as Token)})` }))
      ];
    }
  }
}
