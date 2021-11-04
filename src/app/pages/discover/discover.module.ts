import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { DiscoverRoutingModule } from './discover-routing.module';
import { DiscoverPage } from './pages/discover/discover.page';
import { MembersPage } from './pages/members/members.page';
import { SpacesPage } from './pages/spaces/spaces.page';


@NgModule({
  declarations: [DiscoverPage, SpacesPage, MembersPage],
  exports: [
  ],
  imports: [
    CommonModule,
    RouterModule,
    NzButtonModule,
    NzTypographyModule,
    DiscoverRoutingModule
  ]
})
export class DiscoverModule { }
