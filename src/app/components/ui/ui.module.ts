import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { BadgeModule } from './components/badge/badge.module';
import { IconModule } from './components/icon/icon.module';
import { MemberModule } from './components/member/member.module';

@NgModule({
  exports: [
    IconModule,
    MemberModule,
    BadgeModule
  ],
  imports: [
    CommonModule
  ]
})
export class UiModule { }
