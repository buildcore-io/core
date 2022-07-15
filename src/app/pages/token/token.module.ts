import { CommonModule, DecimalPipe } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CountdownModule } from '@components/countdown/countdown.module';
import { DescriptionModule } from '@components/description/description.module';
import { DrawerToggleModule } from '@components/drawer-toggle/drawer-toggle.module';
import { IconModule } from '@components/icon/icon.module';
import { ModalDrawerModule } from '@components/modal-drawer/modal-drawer.module';
import { RadioModule } from '@components/radio/radio.module';
import { ShareModule } from '@components/share/share.module';
import { SelectSpaceModule } from '@components/space/components/select-space/select-space.module';
import { TabsModule } from '@components/tabs/tabs.module';
import { TokenBidModule } from '@components/token/components/token-bid/token-bid.module';
import { TokenCancelSaleModule } from '@components/token/components/token-cancel-sale/token-cancel-sale.module';
import { TokenInfoDescriptionModule } from '@components/token/components/token-info/token-info-description.module';
import { TokenMintNetworkModule } from '@components/token/components/token-mint-network/token-mint-network.module';
import { TokenOfferPreMintModule } from '@components/token/components/token-offer-pre-mint/token-offer-pre-mint.module';
import { TokenPublicSaleModule } from '@components/token/components/token-public-sale/token-public-sale.module';
import { TokenPurchaseModule } from '@components/token/components/token-purchase/token-purchase.module';
import { TokenRefundModule } from '@components/token/components/token-refund/token-refund.module';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { MarkDownModule } from '@core/pipes/markdown/markdown.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NgChartsModule } from 'ng2-charts';
import { AirdropsPage } from './pages/airdrops/airdrops.page';
import { MetricsPage } from './pages/metrics/metrics.page';
import { NewIntroductionComponent } from './pages/new/introduction/introduction.component';
import { NewMetricsComponent } from './pages/new/metrics/metrics.component';
import { NewPage } from './pages/new/new.page';
import { NewOverviewComponent } from './pages/new/overview/overview.component';
import { NewSummaryComponent } from './pages/new/summary/summary.component';
import { OverviewPage } from './pages/overview/overview.page';
import { TokenBuyComponent } from './pages/token/token-buy/token-buy.component';
import { TokenEditComponent } from './pages/token/token-edit/token-edit.component';
import { TokenInfoComponent } from './pages/token/token-info/token-info.component';
import { TokenProgressComponent } from './pages/token/token-progress/token-progress.component';
import { TokenPage } from './pages/token/token.page';
import { TradePage } from './pages/trade/trade.page';
import { TokenRoutingModule } from './token-routing.module';


@NgModule({
  declarations: [
    OverviewPage,
    TokenPage,
    MetricsPage,
    AirdropsPage,
    NewPage,
    TokenInfoComponent,
    NewMetricsComponent,
    NewOverviewComponent,
    NewSummaryComponent,
    TokenBuyComponent,
    TokenProgressComponent,
    NewIntroductionComponent,
    TradePage,
    TokenEditComponent
  ],
  providers: [
    DecimalPipe
  ],
  imports: [
    CommonModule,
    TokenRoutingModule,
    TabsModule,
    LayoutModule,
    ShareModule,
    NzProgressModule,
    IconModule,
    NzCardModule,
    DrawerToggleModule,
    NzAvatarModule,
    NzTagModule,
    NzDrawerModule,
    NzModalModule,
    NzGridModule,
    TruncateModule,
    NzToolTipModule,
    NzButtonModule,
    MarkDownModule,
    NgChartsModule,
    TokenPurchaseModule,
    NzUploadModule,
    NzIconModule,
    NzTableModule,
    FormsModule,
    ReactiveFormsModule,
    NzInputModule,
    NzFormModule,
    NzDatePickerModule,
    NzSelectModule,
    NzCheckboxModule,
    SelectSpaceModule,
    RadioModule,
    NzRadioModule,
    DescriptionModule,
    CountdownModule,
    TokenPublicSaleModule,
    NzSkeletonModule,
    TokenBidModule,
    TokenRefundModule,
    TokenOfferPreMintModule,
    ModalDrawerModule,
    NgChartsModule,
    IpfsAvatarModule,
    TokenInfoDescriptionModule,
    TokenCancelSaleModule,
    TokenMintNetworkModule
  ]
})
export class TokenModule { }
