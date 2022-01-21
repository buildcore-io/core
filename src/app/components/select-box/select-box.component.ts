import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, TemplateRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectBoxOption {
  label: string;
  value: string;
  img?: string;
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
  @Input() 
  set options(value: SelectBoxOption[]) {
    this._options = value;
    this.onSearchValueChange();
  }
  get options(): SelectBoxOption[] {
    return this._options;
  }
  @Input() suffixIcon: TemplateRef<any> | null = null;
  @Input() optionsWrapperClasses = '';
  @Input() showArrow = false;
  @Input() isSearchable = false;
  
  public onChange = (v: string | undefined) => undefined;
  public disabled = false;
  public isOptionsOpen = false;
  public optionValue?: SelectBoxOption;
  public showImages = true;
  public searchValue = '';
  public shownOptions: SelectBoxOption[] = [];
  private _options: SelectBoxOption[] = [];

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
    this.showImages = this.options.some(r => r.img);
    this.cd.markForCheck();
  }

  public onOptionClick(value: string): void {
    this.writeValue(value);
    this.onChange(this.value);
    this.isOptionsOpen = false;
  }

  public trackBy(index: number, item: SelectBoxOption): string {
    return item.value;
  }

  public onSearchValueChange(): void {
    this.shownOptions = this.options.filter(r => 
      r.label.toLowerCase().includes(this.searchValue.toLowerCase()) || 
      r.value.toLowerCase().includes(this.searchValue.toLowerCase()));
  }

  public onEraseClick(): void {
    this.searchValue = '';
    this.onSearchValueChange();
  }
}
