import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ThemeService } from '@core/services/theme';

@Component({
  selector: 'wen-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent {
  constructor(public themeService: ThemeService) {}
}
