import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, TemplateRef, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectBoxOption {
  label: string;
  value: string;
}

@Component({
  selector: 'wen-select-box',
  templateUrl: './select-box.component.html',
  styleUrls: ['./select-box.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi:true,
      useExisting: SelectBoxComponent
    }
  ]
})
export class SelectBoxComponent implements ControlValueAccessor {

  @Input() value?: string;
  @Input() options: SelectBoxOption[] = [];
  @Input() suffixIcon: TemplateRef<any> | null = null;
  @Input() optionsWrapperClasses = '';

  @ViewChild('wrapper', { static: true }) wrapper?: ElementRef;

  public onChange = (v: string | undefined) => undefined;
  public disabled = false;
  public isOptionsOpen = false;
  public optionValue?: SelectBoxOption;

  constructor(
    private cd: ChangeDetectorRef
  ) {}

  public registerOnChange(fn: (v: string | undefined) => undefined): void {
    this.onChange = fn;
  }

  public registerOnTouched(): void {
    return undefined;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  public writeValue(value: string): void {
    this.value = value;
    this.optionValue = this.options.find(r => r.value === value);
    this.cd.markForCheck();
  }

  public onOptionClick(value: string): void {
    this.writeValue(value);
    this.onChange(this.value);
    this.wrapper?.nativeElement.blur();
  }

  public onFocus(): void {
    this.isOptionsOpen = true;
  }

  public onBlur(): void {
    this.isOptionsOpen = false;
  }

  public trackBy(index: number, item: SelectBoxOption): string {
    return item.value;
  }
}
