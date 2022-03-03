import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { Space } from '@functions/interfaces/models';
import { FILE_SIZES } from '@functions/interfaces/models/base';
import { DataService } from '@pages/nft/services/data.service';

@Component({
  selector: 'wen-nft-preview',
  templateUrl: './nft-preview.component.html',
  styleUrls: ['./nft-preview.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftPreviewComponent {
  @Input()
  set nft(value: any | null) {
    this._nft = value;
    const collection = this.cache.allCollections$.getValue().find((collection) => collection.uid === this.nft?.collection);
    const space = this.cache.allSpaces$.getValue().find((space) => space.uid === collection?.space);
    this.space = space;
  };
  get nft(): any | null {
    return this._nft
  }

  @Output() wenOnClose = new EventEmitter<void>();

  public space?: Space;
  private _nft: any | null;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    public data: DataService,
    public auth: AuthService,
    public cache: CacheService
  ) {}

  public close(): void {
    this.nft = null;
    this.wenOnClose.next();
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public getValues(obj: any): any[] {
    return Object.values(obj);
  }
}
