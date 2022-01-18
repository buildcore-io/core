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

  onChange = (v: string | undefined) => undefined;
  disabled = false;
  isOptionsOpen = false;
  optionValue?: SelectBoxOption;

  constructor(
    private cd: ChangeDetectorRef
  ) {}

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    return undefined;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  writeValue(value: string): void {
    this.value = value;
    this.optionValue = this.options.find(r => r.value === value);
    this.cd.markForCheck();
  }

  onOptionClick(value: string): void {
    this.writeValue(value);
    this.onChange(this.value);
    this.wrapper?.nativeElement.blur();
  }

  onFocus(): void {
    this.isOptionsOpen = true;
  }

  onBlur(): void {
    this.isOptionsOpen = false;
  }
}
