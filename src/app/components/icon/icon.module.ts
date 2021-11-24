import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AngleDownIconComponent } from './angle-down/angle-down.component';
import { AngleUpIconComponent } from './angle-up/angle-up.component';
import { AwardIconComponent } from './award/award.component';
import { BellIconComponent } from './bell/bell.component';
import { CheckCircleIconComponent } from './check-circle/check-circle.component';
import { GlobeIconComponent } from './globe/globe.component';
import { MarketIconComponent } from './market/market.component';
import { MembersIconComponent } from './members/members.component';
import { MoonIconComponent } from './moon/moon.component';
import { RocketIconComponent } from './rocket/rocket.component';
import { SpaceIconComponent } from './space/space.component';
import { SunIconComponent } from './sun/sun.component';
import { UnamusedIconComponent } from './unamused/unamused.component';

@NgModule({
  declarations: [
    GlobeIconComponent,
    RocketIconComponent,
    UnamusedIconComponent,
    SunIconComponent,
    MoonIconComponent,
    MembersIconComponent,
    MarketIconComponent,
    BellIconComponent,
    SpaceIconComponent,
    AwardIconComponent,
    CheckCircleIconComponent,
    AngleDownIconComponent,
    AngleUpIconComponent,
  ],
  exports: [
    GlobeIconComponent,
    RocketIconComponent,
    UnamusedIconComponent,
    SunIconComponent,
    MoonIconComponent,
    MembersIconComponent,
    MarketIconComponent,
    BellIconComponent,
    SpaceIconComponent,
    AwardIconComponent,
    CheckCircleIconComponent,
    AngleDownIconComponent,
    AngleUpIconComponent,
  ],
  imports: [
    CommonModule
  ]
})
export class IconModule { }
