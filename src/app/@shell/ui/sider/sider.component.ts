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
  homeRoute = ROUTER_UTILS.config.base.home 
  menuItems = [
    { route: ROUTER_UTILS.config.member.profile, label: 'My profile' },
    { route: ROUTER_UTILS.config.space.root, label: 'Discover' },
    { route: ROUTER_UTILS.config.base.dashboard, label: 'Overview' },
  ]

  constructor(public themeService: ThemeService) { }
}
