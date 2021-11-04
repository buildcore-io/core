import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UserRoutingModule } from './member-routing.module';
import { ProfilePage } from './pages/profile/profile.page';

@NgModule({
  declarations: [ProfilePage],
  imports: [CommonModule, UserRoutingModule],
})
export class MemberModule {

}
