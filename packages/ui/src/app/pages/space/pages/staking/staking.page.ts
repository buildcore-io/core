import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ThemeList, ThemeService } from '@core/services/theme';
import { DataService } from '@pages/space/services/data.service';
import { SOON_SPACE } from '@soonaverse/interfaces';
import { map, Observable } from 'rxjs';

@Component({
  selector: 'wen-staking',
  templateUrl: './staking.page.html',
  styleUrls: ['./staking.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StakingPage {
  public theme = ThemeList;

  constructor(public themeService: ThemeService, public data: DataService) {}
  public isSoonSpace(): Observable<boolean> {
    return this.data.space$.pipe(
      map((s) => {
        return s?.uid === SOON_SPACE;
      }),
    );
  }
}
