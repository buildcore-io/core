import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UserRoutingModule } from './member-routing.module';
import { MyProfilePage } from './pages/my-profile/my-profile.page';
import { OverviewPage } from './pages/overview/overview.page';

@NgModule({
  declarations: [MyProfilePage, OverviewPage],
  imports: [CommonModule, UserRoutingModule],
})
export class MemberModule {}
