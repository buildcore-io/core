import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Network } from '@functions/interfaces/models';

@Component({
  selector: 'wen-selected-network',
  templateUrl: './selected-network.component.html',
  styleUrls: ['./selected-network.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectedNetworkComponent {
  @Input() public selectedNetwork?: string;

  public get networkTypes(): typeof Network {
    return Network;
  }
}
