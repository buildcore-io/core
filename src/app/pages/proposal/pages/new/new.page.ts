import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { NzDatePickerComponent } from 'ng-zorro-antd/date-picker';

@Component({
  selector: 'wen-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewPage {
  public startValue: Date = new Date();
  public endValue: Date = new Date();
  @ViewChild('endDatePicker') endDatePicker!: NzDatePickerComponent;

  public disabledStartDate(startValue: Date): boolean {
    if (!startValue || !this.endValue) {
      return false;
    }
    return startValue.getTime() > this.endValue.getTime();
  };

  public get urlToSpaces(): string {
    return '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.proposals;
  }

  public disabledEndDate(endValue: Date): boolean {
    if (!endValue || !this.startValue) {
      return false;
    }
    return endValue.getTime() <= this.startValue.getTime();
  };

  public handleStartOpenChange(open: boolean): void {
    if (!open) {
      this.endDatePicker.open();
    }
    console.log('handleStartOpenChange', open);
  }

  handleEndOpenChange(open: boolean): void {
    console.log('handleEndOpenChange', open);
  }

}
