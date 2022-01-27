import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, TemplateRef } from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DeviceService } from '@core/services/device';
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
  @Input() title = '';
  @Input() size: SelectBoxSizes = SelectBoxSizes.SMALL;
  @Input() showArrow = false;
  @Input() isSearchable = false;
  @Input() mobileDrawer = false;
  @Input() isAvatar = false;
  
  public onChange = (v: string | undefined) => undefined;
  public disabled = false;
  public isOptionsOpen = false;
  public optionValue?: SelectBoxOption;
  public showImages = true;
  public searchControl: FormControl = new FormControl('');
  public shownOptions: SelectBoxOption[] = [];
  public selectBoxSizes = SelectBoxSizes;
  public isDrawerOpen = false;
  private _options: SelectBoxOption[] = [];

  constructor(
    private cd: ChangeDetectorRef,
    public deviceService: DeviceService
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
    this.isDrawerOpen = false;
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

  public onClickOutside(): void {
    this.isOptionsOpen = false;
    this.cd.markForCheck();
  }

  public onAngleClick(event: MouseEvent): void {
    event.stopPropagation();
    this.isOptionsOpen = !this.isOptionsOpen;
    this.isDrawerOpen = true;
  }
}
