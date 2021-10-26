import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ROUTER_UTILS } from '@core/utils/router.utils';

@Component({
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPage {
  path = ROUTER_UTILS.config.base;
}
