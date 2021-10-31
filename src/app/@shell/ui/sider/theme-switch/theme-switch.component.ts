import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ThemeList, ThemeService } from '@core/services/theme';

@Component({
  selector: 'wen-theme-switch',
  templateUrl: './theme-switch.component.html',
  styleUrls: ['./theme-switch.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeSwitchComponent {
  theme = ThemeList;

  constructor(public themeService: ThemeService) { }

  onClickChangeTheme(theme: ThemeList): void {
    this.themeService.setTheme(theme);
  }
}
