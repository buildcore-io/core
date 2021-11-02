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
  routes = ROUTER_UTILS.config;

  constructor(public themeService: ThemeService) { }
}
