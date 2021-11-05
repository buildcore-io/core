import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UiModule } from '@components/ui/ui.module';
import { ThemeSwitchComponent } from './theme-switch.component';

@NgModule({
  declarations: [ThemeSwitchComponent],
  imports: [
    CommonModule,
    UiModule
  ],
  exports: [ThemeSwitchComponent]
})

export class ThemeSwitchModule { }
