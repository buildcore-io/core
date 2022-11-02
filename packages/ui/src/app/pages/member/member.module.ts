import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AlgoliaModule } from '@components/algolia/algolia.module';
import { SelectCollectionModule } from '@components/collection/components/select-collection/select-collection.module';
import { DrawerToggleModule } from '@components/drawer-toggle/drawer-toggle.module';
import { MemberAboutModule } from '@components/member/components/member-about/member-about.module';
import { MemberSpaceRowModule } from '@components/member/components/member-space-row/member-space-row.module';
import { MemberTileModule } from '@components/member/components/tile/member-tile.module';
import { MobileSearchModule } from '@components/mobile-search/mobile-search.module';
import { NftCardModule } from '@components/nft/components/nft-card/nft-card.module';
import { NftDepositModule } from '@components/nft/components/nft-deposit/nft-deposit.module';
import { SelectSpaceModule } from '@components/space/components/select-space/select-space.module';
import { TimelineModule } from '@components/timeline/timeline.module';
import { LockedTokenClaimModule } from '@components/token/components/locked-token-claim/locked-token-claim.module';
import { TokenClaimModule } from '@components/token/components/token-claim/token-claim.module';
import { TokenRefundModule } from '@components/token/components/token-refund/token-refund.module';
import { TokenRowModule } from '@components/token/components/token-row/token-row.module';
import { TransactionCardModule } from '@components/transaction/components/transaction-card/transaction-card.module';
import { OnVisibleModule } from '@core/directives/on-visible/on-visible.module';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { IpfsAvatarPipe } from '@core/pipes/ipfs-avatar/ipfs-avatar.pipe';
import { IpfsBadgeModule } from '@core/pipes/ipfs-badge/ipfs-badge.module';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { AwardCardModule } from '../../components/award/components/award-card/award-card.module';
import { TruncateModule } from './../../@core/pipes/truncate/truncate.module';
import { BadgeModule } from './../../components/badge/badge.module';
import { IconModule } from './../../components/icon/icon.module';
import { TabsModule } from './../../components/tabs/tabs.module';
import { UserRoutingModule } from './member-routing.module';
import { ActivityPage } from './pages/activity/activity.page';
import { AwardsPage } from './pages/awards/awards.page';
import { BadgesPage } from './pages/badges/badges.page';
import { MemberPage } from './pages/member/member.page';
import { NFTsPage } from './pages/nfts/nfts.page';
import { MemberSpacesComponent } from './pages/spaces/member-spaces.component';
import { TokensPage } from './pages/tokens/tokens.page';
import { TransactionsPage } from './pages/transactions/transactions.page';
import { DataService } from './services/data.service';

@NgModule({
  declarations: [
    MemberPage,
    ActivityPage,
    AwardsPage,
    BadgesPage,
    MemberSpacesComponent,
    NFTsPage,
    TokensPage,
    TransactionsPage,
  ],
  providers: [DataService, IpfsAvatarPipe],
  imports: [
    CommonModule,
    BadgeModule,
    AwardCardModule,
    TabsModule,
    IpfsAvatarModule,
    MemberAboutModule,
    TruncateModule,
    LockedTokenClaimModule,
    UserRoutingModule,
    NzTagModule,
    NzButtonModule,
    NzTimelineModule,
    NzAvatarModule,
    NzCardModule,
    NzGridModule,
    NzDrawerModule,
    NzTypographyModule,
    NzToolTipModule,
    NzIconModule,
    IconModule,
    LayoutModule,
    DrawerToggleModule,
    NzCheckboxModule,
    FormsModule,
    ReactiveFormsModule,
    NzInputModule,
    MemberSpaceRowModule,
    MemberTileModule,
    MobileSearchModule,
    IpfsBadgeModule,
    SelectSpaceModule,
    NftCardModule,
    NzSkeletonModule,
    InfiniteScrollModule,
    NzSelectModule,
    SelectCollectionModule,
    NzTableModule,
    TokenClaimModule,
    TokenRefundModule,
    TransactionCardModule,
    TokenRowModule,
    OnVisibleModule,
    TimelineModule,
    AlgoliaModule,
    NftDepositModule,
  ],
})
export class MemberModule {}
