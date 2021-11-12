import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UserRoutingModule } from './member-routing.module';
import { ActivityPage } from './pages/activity/activity.page';
import { AwardsPage } from './pages/awards/awards.page';
import { BadgesPage } from './pages/badges/badges.page';
import { MemberPage } from './pages/member/member.page';
import { YieldPage } from './pages/yield/yield.page';

@NgModule({
  declarations: [MemberPage, ActivityPage, AwardsPage, BadgesPage, YieldPage],
  imports: [CommonModule, UserRoutingModule],
})
export class MemberModule {

}
