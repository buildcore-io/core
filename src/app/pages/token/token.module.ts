import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DrawerToggleModule } from '@components/drawer-toggle/drawer-toggle.module';
import { IconModule } from '@components/icon/icon.module';
import { ShareModule } from '@components/share/share.module';
import { TabsModule } from '@components/tabs/tabs.module';
import { TokenPurchaseModule } from '@components/token/components/token-purchase/token-purchase.module';
import { MarkDownModule } from '@core/pipes/markdown/markdown.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NgChartsModule } from 'ng2-charts';
import { AirdropsPage } from './pages/airdrops/airdrops.page';
import { MetricsPage } from './pages/metrics/metrics.page';
import { NewPage } from './pages/new/new.page';
import { OverviewPage } from './pages/overview/overview.page';
import { TokenInfoComponent } from './pages/token/token-info/token-info.component';
import { TokenPage } from './pages/token/token.page';
import { TokenRoutingModule } from './token-routing.module';


@NgModule({
  declarations: [
    OverviewPage,
    TokenPage,
    MetricsPage,
    AirdropsPage,
    NewPage,
    TokenInfoComponent
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
    NzTableModule
  ]
})
export class TokenModule { }
