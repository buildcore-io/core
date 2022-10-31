import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ThemeList, ThemeService } from '@core/services/theme';
import { UntilDestroy } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  selector: 'wen-swap',
  templateUrl: './swap.page.html',
  styleUrls: ['./swap.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwapPage {
  public theme = ThemeList;

  constructor(public themeService: ThemeService) {}

  public onClickChangeTheme(theme: ThemeList): void {
    this.themeService.setTheme(theme);
  }
}
