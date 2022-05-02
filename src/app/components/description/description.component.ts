import { ChangeDetectionStrategy, Component, Input, TemplateRef } from '@angular/core';
import { DeviceService } from '@core/services/device';

export interface DescriptionItem {
  title: string | number;
  value?: string | number| null;
  extraValue?: string | number | null;
  link?: {
    label: string | number;
    href: string;
  };
  titleIcon?: TemplateRef<unknown>;
  titleTemplate?: TemplateRef<unknown>;
  valueTemplate?: TemplateRef<unknown>;
  backgroundClass?: string;
}

@Component({
  selector: 'wen-description',
  templateUrl: './description.component.html',
  styleUrls: ['./description.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DescriptionComponent {
  @Input() title? = '';
  @Input() 
  set items(value: Array<DescriptionItem | null>) {
    this._items = value.filter((r) => !!r) as DescriptionItem[];
  };
  get items(): Array<DescriptionItem> {
    return this._items;
  }

  private _items: Array<DescriptionItem> = [];

  constructor(
    public deviceService: DeviceService
  ) {}
}
