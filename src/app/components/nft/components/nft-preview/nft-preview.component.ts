import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FileApi } from '@api/file.api';
import { AuthService } from '@components/auth/services/auth.service';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { Space } from '@functions/interfaces/models';
import { FILE_SIZES } from '@functions/interfaces/models/base';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/nft/services/data.service';
import { take } from 'rxjs';

@UntilDestroy()
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
    if (this._nft) {
      this.fileApi.getMetadata(this._nft.media).pipe(take(1), untilDestroyed(this)).subscribe((o) => {
        if (o.contentType.match('video/.*')) {
          this.mediaType = 'video';
        } else if (o.contentType.match('image/.*')) {
          this.mediaType = 'image';
        }

        this.cd.markForCheck();
      });
    }
  };
  get nft(): any | null {
    return this._nft
  }

  @Output() wenOnClose = new EventEmitter<void>();

  public space?: Space;
  public mediaType: 'video'|'image'|undefined;
  private _nft: any | null;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    public data: DataService,
    public auth: AuthService,
    public cache: CacheService,
    private cd: ChangeDetectorRef,
    private fileApi: FileApi
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
