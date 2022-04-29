import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CollectionCardModule } from '@components/collection/components/collection-card/collection-card.module';
import { DropdownTabsModule } from '@components/dropdown-tabs/dropdown-tabs.module';
import { IconModule } from '@components/icon/icon.module';
import { MobileSearchModule } from '@components/mobile-search/mobile-search.module';
import { NftCardModule } from '@components/nft/components/nft-card/nft-card.module';
import { SelectSpaceModule } from '@components/space/components/select-space/select-space.module';
import { TabsModule } from '@components/tabs/tabs.module';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { MarketRoutingModule } from './market-routing.module';
import { CollectionsPage } from './pages/collections/collections.page';
import { MarketPage } from './pages/market/market.page';
import { NFTsPage } from './pages/nfts/nfts.page';
import { FilterService } from './services/filter.service';
import {NgAisModule} from "angular-instantsearch";
import {SearchBox} from "@pages/market/pages/market/search.component";
import {SortBy} from "@pages/market/pages/market/sort.component";
import {RefinementList} from "@pages/market/pages/market/refinement.component";

@NgModule({
  declarations: [
    MarketPage,
    CollectionsPage,
    NFTsPage,
    SearchBox,
    SortBy,
    RefinementList
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
    SelectSpaceModule,
    CollectionCardModule,
    InfiniteScrollModule,
    NzSkeletonModule,
    NftCardModule,
    NgAisModule.forRoot()

  ],
  providers: [FilterService]
})
export class MarketModule { }
