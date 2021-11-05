import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GlobeIconComponent } from '@components/ui/components/icon/globe/globe.component';
import { RocketIconComponent } from '@components/ui/components/icon/rocket/rocket.component';
import { UnamusedIconComponent } from '@components/ui/components/icon/unamused/unamused.component';
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
    { route: [ROUTER_UTILS.config.base.dashboard], icon: GlobeIconComponent },
    { route: [ROUTER_UTILS.config.discover.root], icon: RocketIconComponent },
    // TODO - replace with user id given from auth service
    { route: [ROUTER_UTILS.config.member.root, 'adam-rich'], icon: UnamusedIconComponent },
  ]
}
