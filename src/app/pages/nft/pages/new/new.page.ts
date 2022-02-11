import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Units } from '@core/utils/units-helper';

export const PRICE_UNITS: Units[] = ['Mi', 'Gi'];
export enum StepType {
  GENERATE = 'Generate',
  PUBLISH = 'Publish'
}
export const MAX_PROPERTIES_COUNT = 5;
export const MAX_STATS_COUNT = 5;

@Component({
  selector: 'wen-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewPage {
  public sections = [
    { route: [ ROUTER_UTILS.config.nft.single], label: 'Single' },
    { route: [ ROUTER_UTILS.config.nft.multiple], label: 'Multiple' }
  ];

  constructor(
    public deviceService: DeviceService
  ) {}
}
