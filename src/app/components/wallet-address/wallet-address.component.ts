import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { copyToClipboard } from '@core/utils/tools.utils';
import { Member } from '@functions/interfaces/models';
import { getAddress } from '@functions/src/utils/address.utils';
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
    public deviceService: DeviceService,
    private cd: ChangeDetectorRef
  ) {}

  public get address(): string|undefined {
    return getAddress(this.entity?.validatedAddress);
  }

  public copyAddress() {
    if (!this.isCopied && this.address) {
      copyToClipboard(this.address)
      this.isCopied = true;
      setTimeout(() => {
        this.isCopied = false;
        this.cd.markForCheck();
      }, 3000);
    }
  }

  public close(): void {
    this.isVerifyAddressOpen = false;
    this.cd.markForCheck();
  }

  public getModalWidth(): string {
    switch (this.type) {
    case AddressType.IOTA:
      return '760px';
    default:
      return '760px';
    }
  }
}
