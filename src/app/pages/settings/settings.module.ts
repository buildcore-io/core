import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AppearancePage } from './pages/appearance/appearance.page';
import { NotificationsPage } from './pages/notifications/notifications.page';
import { SecurityLogPage } from './pages/security-log/security-log.page';
import { SecurityPage } from './pages/security/security.page';
import { SpacePage } from './pages/space/space.page';
import { SettingsRoutingModule } from './settings-routing.module';

@NgModule({
  declarations: [
    SpacePage,
    AppearancePage,
    NotificationsPage,
    SecurityPage,
    SecurityLogPage,
  ],
  imports: [CommonModule, SettingsRoutingModule],
})
export class SettingsModule {}
