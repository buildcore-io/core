import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreviewImageService } from '@core/services/preview-image';
import { Token } from '@functions/interfaces/models/token';
import { DataService } from '@pages/token/services/data.service';
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
    public data: DataService
  ) {}

  public getCooldownDuration(token?: Token): string {
    if (!token || !token.coolDownEnd || !token.saleStartDate) {
      return '-';
    }

    const v: number = dayjs(token.coolDownEnd.toDate()).diff(dayjs(token.saleStartDate.toDate()).add(token.saleLength || 0, 'ms'), 'ms');
    return dayjs.duration({ milliseconds: v }).humanize();
  }
}
