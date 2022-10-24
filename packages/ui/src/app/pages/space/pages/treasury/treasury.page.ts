import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ThemeList, ThemeService } from '@core/services/theme';

@Component({
  selector: 'wen-treasury',
  templateUrl: './treasury.page.html',
  styleUrls: ['./treasury.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreasuryPage {
  public theme = ThemeList;

  constructor(public themeService: ThemeService) {}
}
