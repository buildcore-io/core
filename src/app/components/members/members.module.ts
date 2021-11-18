import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MembersCardModule } from './components/member-card/member-card.module';

@NgModule({
  exports: [
    MembersCardModule,
  ],
  imports: [
    CommonModule
  ]
})

export class MembersModule { }
