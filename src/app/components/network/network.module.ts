import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { SelectedNetworkComponent } from './components/selected-network/selected-network.component';

@NgModule({
  declarations: [SelectedNetworkComponent],
  imports: [
    CommonModule,
    IconModule
  ],
  exports: [SelectedNetworkComponent],
})
export class NetworkModule {}
