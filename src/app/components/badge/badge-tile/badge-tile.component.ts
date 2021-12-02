import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FileMetedata, FILE_SIZES } from "../../../../../functions/interfaces/models/base";

@Component({
  selector: 'wen-badge-tile',
  templateUrl: './badge-tile.component.html',
  styleUrls: ['./badge-tile.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BadgeTileComponent {
  @Input() size?: string;
  @Input() metadata?: FileMetedata;

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }
}
