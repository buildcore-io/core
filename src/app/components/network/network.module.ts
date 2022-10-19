import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { SelectNetworkComponent } from './components/select-network/select-network.component';
import { SelectedNetworkComponent } from './components/selected-network/selected-network.component';
import { SendFundsComponent } from './components/send-funds/send-funds.component';

@NgModule({
  declarations: [SelectedNetworkComponent, SelectNetworkComponent, SendFundsComponent],
  imports: [
    CommonModule,
    IconModule
  ],
  exports: [SelectedNetworkComponent, SelectNetworkComponent, SendFundsComponent],
})
export class NetworkModule {}
