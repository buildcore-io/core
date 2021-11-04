import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { DiscoverRoutingModule } from './discover-routing.module';
import { AwardsPage } from './pages/awards/awards.page';
import { DiscoverPage } from './pages/discover/discover.page';
import { MembersPage } from './pages/members/members.page';
import { SpacesPage } from './pages/spaces/spaces.page';


@NgModule({
  declarations: [DiscoverPage, SpacesPage, MembersPage, AwardsPage],
  exports: [
  ],
  imports: [
    CommonModule,
    RouterModule,
    NzMenuModule,
    NzTypographyModule,
    DiscoverRoutingModule
  ]
})
export class DiscoverModule { }
