import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, TemplateRef } from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

export interface SelectBoxOption {
  label: string;
  value: string;
  img?: string;
}

export enum SelectBoxSizes {
  SMALL = 'small',
  LARGE = 'large'
}

@UntilDestroy()
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
export class SelectBoxComponent implements OnInit, ControlValueAccessor {

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
  @Input() size: SelectBoxSizes = SelectBoxSizes.SMALL;
  @Input() showArrow = false;
  @Input() isSearchable = false;
  
  public onChange = (v: string | undefined) => undefined;
  public disabled = false;
  public isOptionsOpen = false;
  public optionValue?: SelectBoxOption;
  public showImages = true;
  public searchControl: FormControl = new FormControl('');
  public shownOptions: SelectBoxOption[] = [];
  public selectBoxSizes = SelectBoxSizes;
  private _options: SelectBoxOption[] = [];

  constructor(
    private cd: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
      this.searchControl.valueChanges
        .pipe(untilDestroyed(this))
        .subscribe(this.onSearchValueChange.bind(this));
  }

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
      r.label.toLowerCase().includes(this.searchControl.value.toLowerCase()) || 
      r.value.toLowerCase().includes(this.searchControl.value.toLowerCase()));
  }

  public onEraseClick(): void {
    this.searchControl.setValue('');
    this.onSearchValueChange();
  }
}
