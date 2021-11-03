import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UserRoutingModule } from './member-routing.module';
import { OverviewPage } from './pages/overview/overview.page';
import { ProfilePage } from './pages/profile/profile.page';

@NgModule({
  declarations: [ProfilePage, OverviewPage],
  imports: [CommonModule, UserRoutingModule],
})
export class MemberModule {}
