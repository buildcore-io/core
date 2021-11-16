import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AwardsCardModule } from './components/award-card/award-card.module';

@NgModule({
  exports: [
    AwardsCardModule
  ],
  imports: [
    CommonModule,
  ]
})

export class AwardsModule { }
