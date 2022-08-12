import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AlgoliaModule } from '@components/algolia/algolia.module';
import { IconModule } from '@components/icon/icon.module';
import { TokenHighlightCardModule } from '@components/token/components/token-highlight-card/token-highlight-card.module';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzCardModule } from 'ng-zorro-antd/card';

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
    TokenHighlightCardModule
  ]
})
export class TokensModule { }
