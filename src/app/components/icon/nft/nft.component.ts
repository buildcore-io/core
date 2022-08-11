import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'wen-icon-nft',
  templateUrl: './nft.component.html',
  styleUrls: ['./nft.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftIconComponent {
  @Input() size = 24;
}