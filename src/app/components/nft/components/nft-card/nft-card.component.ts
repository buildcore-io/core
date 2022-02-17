import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UnitsHelper } from '@core/utils/units-helper';
import { Collection } from 'functions/interfaces/models';
import { Nft } from 'functions/interfaces/models/nft';

@Component({
  selector: 'wen-nft-card',
  templateUrl: './nft-card.component.html',
  styleUrls: ['./nft-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftCardComponent {
  @Input() fullWidth?: boolean;
  @Input() nft?: Nft|null;
  @Input() collection?: Collection|null;
  @Input() isOwned = false;

  public isCheckoutOpen = false;
  public path = ROUTER_UTILS.config.nft.root;

  constructor(
    public deviceService: DeviceService
  ) {}

  public onBuy(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.isCheckoutOpen = true;
  }

  public formatBest(amount?: number|null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
  }
}
