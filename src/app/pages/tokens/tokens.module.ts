import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AlgoliaModule } from '@components/algolia/algolia.module';
import { IconModule } from '@components/icon/icon.module';
import { MobileSearchModule } from '@components/mobile-search/mobile-search.module';
import { TabsModule } from '@components/tabs/tabs.module';
import { TokenHighlightCardModule } from '@components/token/components/token-highlight-card/token-highlight-card.module';
import { TokenRowModule } from '@components/token/components/token-row/token-row.module';
import { TokenTradingPairRowModule } from '@components/token/components/token-trading-pair-row/token-trading-pair-row.module';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';

import { AllTokensPage } from './pages/all-tokens/all-tokens.page';
import { FavouritesPage } from './pages/favourites/favourites.page';
import { LaunchpadPage } from './pages/launchpad/launchpad.page';
import { TokensPage } from './pages/tokens/tokens.page';
import { TradingPairsPage } from './pages/trading-pairs/trading-pairs.page';
import { TokensRoutingModule } from './tokens-routing.module';


@NgModule({
  declarations: [
    TokensPage,
    FavouritesPage,
    AllTokensPage,
    TradingPairsPage,
    LaunchpadPage
  ],
  imports: [
    CommonModule,
    TokensRoutingModule,
    NzCardModule,
    LayoutModule,
    AlgoliaModule,
    IconModule,
    TokenHighlightCardModule,
    TokenRowModule,
    InfiniteScrollModule,
    NzInputModule,
    NzSkeletonModule,
    FormsModule,
    ReactiveFormsModule,
    NzFormModule,
    TabsModule,
    MobileSearchModule,
    TokenTradingPairRowModule
  ]
})
export class TokensModule { }
