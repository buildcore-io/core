import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FileApi } from '@api/file.api';
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/token/services/data.service';
import { switchMap, take } from 'rxjs';
import { filter } from 'rxjs/operators';

@UntilDestroy()
@Component({
  selector: 'wen-overview',
  templateUrl: './overview.page.html',
  styleUrls: ['./overview.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewPage implements OnInit {
  public mediaType: 'video' | 'image' | undefined;

  constructor(
    public deviceService: DeviceService,
    public data: DataService,
    private fileApi: FileApi,
    private cd: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    this.data.token$
      .pipe(
        filter(token => !!token?.overviewGraphics),
        switchMap(token => this.fileApi.getMetadata(token?.overviewGraphics || '').pipe(take(1))),
        untilDestroyed(this)
      )
      .subscribe(o => {
        if (o.contentType?.match('video/.*')) {
          this.mediaType = 'video';
        } else if (o.contentType?.match('image/.*')) {
          this.mediaType = 'image';
        }

        this.cd.markForCheck();
      });
  }
}
