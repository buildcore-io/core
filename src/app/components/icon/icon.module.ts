import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { GlobeIconComponent } from './globe/globe.component';
import { MembersIconComponent } from './members/members.component';
import { MoonIconComponent } from './moon/moon.component';
import { RocketIconComponent } from './rocket/rocket.component';
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
  ],
  exports: [
    GlobeIconComponent,
    RocketIconComponent,
    UnamusedIconComponent,
    SunIconComponent,
    MoonIconComponent,
    MembersIconComponent,
  ],
  imports: [
    CommonModule
  ]
})
export class IconModule { }
