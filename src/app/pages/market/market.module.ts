import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DropdownTabsModule } from '@components/dropdown-tabs/dropdown-tabs.module';
import { IconModule } from '@components/icon/icon.module';
import { MobileSearchModule } from '@components/mobile-search/mobile-search.module';
import { SelectSpaceModule } from '@components/select-space/select-space.module';
import { TabsModule } from '@components/tabs/tabs.module';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { MarketRoutingModule } from './market-routing.module';
import { CollectionsPage } from './pages/collections/collections.page';
import { MarketPage } from './pages/market/market.page';
import { NFTsPage } from './pages/nfts/nfts.page';
import { FilterService } from './services/filter.service';

@NgModule({
  declarations: [
    MarketPage,
    CollectionsPage,
    NFTsPage
  ],
  imports: [
    CommonModule,
    MarketRoutingModule,
    NzCardModule,
    LayoutModule,
    NzInputModule,
    DropdownTabsModule,
    MobileSearchModule,
    TabsModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    NzIconModule,
    NzTagModule,
    NzSelectModule,
    IconModule,
    SelectSpaceModule
  ],
  providers: [FilterService]
})
export class MarketModule { }
