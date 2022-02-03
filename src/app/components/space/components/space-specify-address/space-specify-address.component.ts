import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';

export enum AddressType {
  IOTA = 'IOTA'
}

@Component({
  selector: 'wen-space-specify-address',
  templateUrl: './space-specify-address.component.html',
  styleUrls: ['./space-specify-address.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpaceSpecifyAddressComponent {
  @Input() type = AddressType.IOTA;

  public isVerifyAddressOpen = true;
  public addressTypes = AddressType;

  constructor(
    public deviceService: DeviceService
  ) {}

  public getModalWidth(): string {
    switch (this.type) {
      case AddressType.IOTA:
        return '720px';
      default:
        return '720px';
    }
  }
}
