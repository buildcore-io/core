import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Nft } from 'functions/interfaces/models/nft';

@Component({
  selector: 'wen-nft-card',
  templateUrl: './nft-card.component.html',
  styleUrls: ['./nft-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftCardComponent {
  @Input() fullWidth?: boolean;
  @Input() nft?: Nft;
  
  public path = ROUTER_UTILS.config.nft.root;

  constructor(
    public deviceService: DeviceService
  ) {}
}
