import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { copyToClipboard } from '@core/utils/tools.utils';
import { Member } from 'functions/interfaces/models';
import { Space } from './../../../../functions/interfaces/models/space';

export enum AddressType {
  IOTA = 'IOTA'
}

export enum EntityType {
  SPACE = 'SPACE',
  MEMBER = 'MEMBER'
}

@Component({
  selector: 'wen-wallet-address',
  templateUrl: './wallet-address.component.html',
  styleUrls: ['./wallet-address.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletAddressComponent {
  @Input() type = AddressType.IOTA;
  @Input() entityType?: EntityType;
  @Input() entity?: Space|Member|null;
  @Input() enableVerification = false;

  public isVerifyAddressOpen = false;
  public addressTypes = AddressType;
  public isCopied = false;

  constructor(
    public deviceService: DeviceService
  ) {}

  public get address(): string|undefined {
    return this.entity?.validatedAddress;
  }

  public copyAddress() {
    if (!this.isCopied && this.address) {
      copyToClipboard(this.address)
      this.isCopied = true;
    }
  }

  public getModalWidth(): string {
    switch (this.type) {
      case AddressType.IOTA:
        return '720px';
      default:
        return '720px';
    }
  }
}
