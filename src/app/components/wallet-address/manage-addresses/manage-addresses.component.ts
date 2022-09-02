import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { NETWORK_DETAIL } from '@core/services/units';
import { DEFAULT_NETWORK } from '@functions/interfaces/config';
import { Member, Network, Space } from '@functions/interfaces/models';

@Component({
  selector: 'wen-manage-addresses',
  templateUrl: './manage-addresses.component.html',
  styleUrls: ['./manage-addresses.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ManageAddressesComponent {
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() entity?: Space | Member | null;
  @Output() wenOnChange = new EventEmitter<Network>();
  @Output() wenOnClose = new EventEmitter<void>();
  public networks = Network;

  private _isOpen = false;

  constructor(
    public deviceService: DeviceService
  ) {}

  public close(): void {
    this.isOpen = false;
    this.wenOnClose.next();
  }

  public networkName(network: Network | null): string | undefined {
    return Object.entries(this.networks).find(([key, value]) => value === network)?.[0];
  }

  public address(network?: Network): string | undefined {
    return (this.entity?.validatedAddress || {})[network || DEFAULT_NETWORK] || '';
  }

  public get networkDetails(): typeof NETWORK_DETAIL {
    return NETWORK_DETAIL;
  }
}
