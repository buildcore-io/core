import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthModule } from '@components/auth/auth.module';
import { HeaderComponent } from './header.component';

@NgModule({
  declarations: [HeaderComponent],
  imports: [
    CommonModule,
    AuthModule,
    RouterModule
  ],
  exports: [HeaderComponent],
})
export class HeaderModule {}
