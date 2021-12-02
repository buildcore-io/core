import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IpfsAvatarPipe } from './ipfs-avatar.pipe';

@NgModule({
  declarations: [IpfsAvatarPipe],
  imports: [CommonModule],
  exports: [IpfsAvatarPipe],
})
export class IpfsAvatarModule {}
