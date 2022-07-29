import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FileApi } from '@api/file.api';
import { AuthService } from '@components/auth/services/auth.service';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsService } from '@core/services/units';
import { Space } from '@functions/interfaces/models';
import { FILE_SIZES } from '@functions/interfaces/models/base';
import { Nft } from '@functions/interfaces/models/nft';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/nft/services/data.service';
import { HelperService } from '@pages/nft/services/helper.service';
import { switchMap, take } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-nft-preview',
  templateUrl: './nft-preview.component.html',
  styleUrls: ['./nft-preview.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftPreviewComponent {
  @Input()
  set nft(value: Nft | null) {
    this._nft = value;
    this.cache.getCollection(this.nft?.collection)
      .pipe(
        switchMap(collection => this.cache.getSpace(collection?.space)),
        untilDestroyed(this)
      )
      .subscribe((space?: Space) => {
        this.space = space;
        this.cd.markForCheck();
      });
    if (this.nft) {
      this.fileApi.getMetadata(this.nft.media).pipe(take(1), untilDestroyed(this)).subscribe((o) => {
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
  public mediaType: 'video' | 'image' | undefined;
  public systemInfoLabels: string[] = [
    $localize`Migrate`,
    $localize`IPFS Metadata`,
    $localize`IPFS Image`
  ];
  public systemInfoValues: { [key: string]: string } = {
    preparing: $localize`Preparing...`,
    tokenization: $localize`Shimmer/Mainnet (Tokenization)...SOON.`
  };
  private _nft: any | null;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    public helper: HelperService,
    public unitsService: UnitsService,
    public data: DataService,
    public auth: AuthService,
    public cache: CacheService,
    private cd: ChangeDetectorRef,
    private fileApi: FileApi
  ) { }

  public close(): void {
    this.nft = null;
    this.wenOnClose.next();
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public getValues(obj: Nft) {
    return Object.values(obj).map(({ label, value }) => ({ title: label, value }));
  }
}
