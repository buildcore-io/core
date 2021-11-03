import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ThemeService } from '@core/services/theme';
import { ROUTER_UTILS } from '@core/utils/router.utils';

@Component({
  selector: 'wen-sider',
  templateUrl: './sider.component.html',
  styleUrls: ['./sider.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SiderComponent {
  path = ROUTER_UTILS.config.base;

  constructor(public themeService: ThemeService) { }
}
