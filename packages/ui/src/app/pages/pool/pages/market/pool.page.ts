import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ThemeList, ThemeService } from '@core/services/theme';
import { UntilDestroy } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  selector: 'wen-pool',
  templateUrl: './pool.page.html',
  styleUrls: ['./pool.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolPage {
  public theme = ThemeList;

  constructor(public themeService: ThemeService) {}

  public onClickChangeTheme(theme: ThemeList): void {
    this.themeService.setTheme(theme);
  }
}
