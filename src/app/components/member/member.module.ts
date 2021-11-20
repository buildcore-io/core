import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MemberCardModule } from './components/member-card/member-card.module';

@NgModule({
  exports: [
    MemberCardModule,
  ],
  imports: [
    CommonModule
  ]
})

export class MemberModule { }
