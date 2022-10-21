import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR, Validators } from '@angular/forms';
import { UnitsService } from '@core/services/units';
import { MAX_IOTA_AMOUNT, MIN_IOTA_AMOUNT } from '@functions/interfaces/config';
import { Collection } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

export enum IotaInputSize {
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
      useExisting: IotaInputComponent,
    },
  ],
})
export class IotaInputComponent implements OnInit, ControlValueAccessor {
  @Input() size: IotaInputSize = IotaInputSize.LARGE;
  @Input() collection?: Collection;
  @Input() min = MIN_IOTA_AMOUNT;
  @Input() max = MAX_IOTA_AMOUNT;

  public amountControl: FormControl = new FormControl(null, [Validators.required, Validators.min(this.min / 1000 / 1000), Validators.max(this.max / 1000 / 1000)]);

  public onChange: (v: number | undefined) => undefined = () => undefined;
  public disabled = false;

  constructor(
    public unitsService: UnitsService,
    private cd: ChangeDetectorRef,
  ) {
  }

  public ngOnInit(): void {
    this.amountControl.valueChanges.pipe(untilDestroyed(this)).subscribe(value => {
      this.onChange(value * 1000 * 1000);
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
    } else {
      this.amountControl.setValue(value / 1000 / 1000);
    }
    this.cd.markForCheck();
  }
}
