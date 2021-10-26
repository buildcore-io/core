import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { AppearancePage } from './pages/appearance/appearance.page';
import { NotificationsPage } from './pages/notifications/notifications.page';
import { SecurityLogPage } from './pages/security-log/security-log.page';
import { SecurityPage } from './pages/security/security.page';
import { SpacePage } from './pages/space/space.page';

const routes: Routes = [
  {
    path: ROUTER_UTILS.config.settings.account,
    component: SpacePage,
  },
  {
    path: ROUTER_UTILS.config.settings.appearance,
    component: AppearancePage,
  },
  {
    path: ROUTER_UTILS.config.settings.notifications,
    component: NotificationsPage,
  },
  {
    path: ROUTER_UTILS.config.settings.security,
    component: SecurityPage,
  },
  {
    path: ROUTER_UTILS.config.settings.securityLog,
    component: SecurityLogPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SettingsRoutingModule {}
