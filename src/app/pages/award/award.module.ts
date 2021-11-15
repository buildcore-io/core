import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AwardRoutingModule } from './award-routing.module';
import { AwardPage } from './pages/award/award.page';
import { NewPage } from './pages/new/new.page';
import { OverviewPage } from './pages/overview/overview.page';
import { ParticipantsPage } from './pages/participants/participants.page';

@NgModule({
  declarations: [
    NewPage,
    AwardPage,
    OverviewPage,
    ParticipantsPage
  ],
  imports: [
    CommonModule,
    AwardRoutingModule
  ]
})
export class AwardModule { }
