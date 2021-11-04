import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { GlobeIconComponent } from './globe/globe.component';
import { RocketIconComponent } from './rocket/rocket.component';
import { UnamusedIconComponent } from './unamused/unamused.component';



@NgModule({
  declarations: [
    GlobeIconComponent,
    RocketIconComponent,
    UnamusedIconComponent
  ],
  exports: [
    GlobeIconComponent,
    RocketIconComponent,
    UnamusedIconComponent
  ],
  imports: [
    CommonModule
  ]
})
export class IconModule { }
