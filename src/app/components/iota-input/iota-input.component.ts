import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR, Validators } from '@angular/forms';
import { Units } from '@core/utils/units-helper';
import { MAX_IOTA_AMOUNT, MIN_IOTA_AMOUNT } from '@functions/interfaces/config';
import { PRICE_UNITS } from '@functions/interfaces/models/nft';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { merge } from 'rxjs';

export enum IotaInputSize {
  SMALL = 'small',
  LARGE = 'large'
}

@UntilDestroy()
@Component({
  selector: 'wen-iota-input',
  templateUrl: './iota-input.component.html',
  styleUrls: ['./iota-input.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: IotaInputComponent
    }
  ]
})
export class IotaInputComponent implements OnInit, ControlValueAccessor {
  @Input() size: IotaInputSize = IotaInputSize.LARGE;
  @Input() min = MIN_IOTA_AMOUNT;
  @Input() max = MAX_IOTA_AMOUNT;
  
  public amountControl: FormControl = new FormControl(null, Validators.required);
  public unitControl: FormControl = new FormControl(<Units>'Mi', Validators.required);

  public onChange: (v: number | undefined) => undefined = () => undefined;
  public disabled = false;

  constructor(
    private cd: ChangeDetectorRef
  ) { }

  public ngOnInit(): void {
    merge(this.unitControl.valueChanges, this.amountControl.valueChanges)
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        const value = this.getRawPrice(Number(this.amountControl.value), <Units> this.unitControl.value);
        const errors = value >= this.min && value <= this.max ? null : { price: { valid: false } };
        this.amountControl.setErrors(errors);
        this.onChange(value)
        this.cd.markForCheck();
      });
  }

  public registerOnChange(fn: () => undefined): void {
    this.onChange = fn;
  }

  public registerOnTouched(): void {
    return undefined;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  public writeValue(value: number | null): void {
    if (value === null) {
      this.amountControl.setValue(null);
      this.unitControl.setValue(<Units>'Mi');
    } else if (value >= 1000 * 1000 * 1000) {
      this.amountControl.setValue(value / 1000 / 1000 / 1000);
      this.unitControl.setValue(<Units>'Gi');
    } else {
      this.amountControl.setValue(value / 1000 / 1000);
      this.unitControl.setValue(<Units>'Mi');
    }
    this.cd.markForCheck();
  }

  public get priceUnits(): Units[] {
    return PRICE_UNITS;
  }

  private getRawPrice(price: number, unit: Units): number {
    return price * (unit === 'Gi' ? 1000 * 1000 * 1000 : 1000 * 1000);
  }
}
