import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreviewImageService } from '@core/services/preview-image';
import { DataService } from '@pages/token/services/data.service';
import { HelperService } from '@pages/token/services/helper.service';
import * as dayjs from 'dayjs';
import * as duration from 'dayjs/plugin/duration';
dayjs.extend(duration);

@Component({
  selector: 'wen-token-info',
  templateUrl: './token-info.component.html',
  styleUrls: ['./token-info.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenInfoComponent {

  public tokenScheduleLabels: string[] = [
    $localize`Sale starts`,
    $localize`Sale ends`,
    $localize`Cooldown Period Length`,
    $localize`Cooldown Period Ends`
  ];
  public tokenInfoLabels: string[] = [
    $localize`Icon`,
    $localize`Name`,
    $localize`Symbol`,
    $localize`Initial Price`,
    $localize`Network`,
    $localize`Total supply`,
    $localize`Current distribution`,
    $localize`Type`
  ];

  constructor(
    public previewImageService: PreviewImageService,
    public data: DataService,
    public helper: HelperService
  ) {}
}
