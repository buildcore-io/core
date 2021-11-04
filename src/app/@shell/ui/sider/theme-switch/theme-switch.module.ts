import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ThemeSwitchComponent } from './theme-switch.component';

@NgModule({
  declarations: [ThemeSwitchComponent],
  imports: [
    CommonModule
  ],
  exports: [ThemeSwitchComponent]
})

export class ThemeSwitchModule { }
