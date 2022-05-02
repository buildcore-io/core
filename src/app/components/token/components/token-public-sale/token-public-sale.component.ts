import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { DescriptionItem } from '@components/description/description.component';
import dayjs from 'dayjs';

@Component({
  selector: 'wen-token-public-sale',
  templateUrl: './token-public-sale.component.html',
  styleUrls: ['./token-public-sale.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenPublicSaleComponent {
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Output() wenOnClose = new EventEmitter<void>();

  public startDateControl: FormControl = new FormControl('', Validators.required);
  public offerLengthControl: FormControl = new FormControl(null, [Validators.required, Validators.min(1)]);
  public offeringLengthOptions = Array.from({length: 10}, (_, i) => i + 1)
  public allocationInfo: DescriptionItem[] = [
    { title: 'Price per token', value: '1 Mi' },
    { title: 'Public sale', value: '10%', extraValue: '(10 000 Mi)' }
  ];
  private _isOpen = false;

  constructor(
    private cd: ChangeDetectorRef
  ) { }

  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }
  
  public reset(): void {
    this.isOpen = false;
    this.cd.markForCheck();
  }

  public disabledStartDate(startValue: Date): boolean {
    // Disable past dates & today + 1day startValue
    if (startValue.getTime() < dayjs().toDate().getTime()) {
      return true;
    }

    return false;
  }
}
