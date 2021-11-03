import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { OverviewPage } from './pages/overview/overview.page';
import { SpaceRoutingModule } from './space-routing.module';


@NgModule({
  declarations: [
    OverviewPage
  ],
  imports: [
    CommonModule,
    SpaceRoutingModule
  ]
})
export class SpaceModule { }
