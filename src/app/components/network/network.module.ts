import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { SelectNetworkComponent } from './components/select-network/select-network.component';
import { SelectedNetworkComponent } from './components/selected-network/selected-network.component';

@NgModule({
  declarations: [SelectedNetworkComponent, SelectNetworkComponent],
  imports: [
    CommonModule,
    IconModule
  ],
  exports: [SelectedNetworkComponent, SelectNetworkComponent],
})
export class NetworkModule {}
