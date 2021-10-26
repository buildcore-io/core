import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
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
    CommonModule
  ],
})
export class AuthModule {}
