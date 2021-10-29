import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzNotificationModule } from 'ng-zorro-antd/notification';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { SignInComponent } from './components/sign-in/sign-in.component';
import { SignOutComponent } from './components/sign-out/sign-out.component';
@NgModule({
  declarations: [
    SignInComponent,
    SignOutComponent
  ],
  exports: [
    SignInComponent,
    SignOutComponent
  ],
  imports: [
    CommonModule,
    NzAvatarModule,
    NzTypographyModule,
    NzNotificationModule
  ],
})
export class AuthModule {}
