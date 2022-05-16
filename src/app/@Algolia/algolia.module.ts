import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { CollectionCardModule } from "@components/collection/components/collection-card/collection-card.module";
import { DropdownTabsModule } from "@components/dropdown-tabs/dropdown-tabs.module";
import { IconModule } from "@components/icon/icon.module";
import { MobileSearchModule } from "@components/mobile-search/mobile-search.module";
import { NftCardModule } from "@components/nft/components/nft-card/nft-card.module";
import { SelectSpaceModule } from "@components/space/components/select-space/select-space.module";
import { TabsModule } from "@components/tabs/tabs.module";
import { TokenRowModule } from "@components/token/components/token-row/token-row.module";
import { NgAisModule } from "angular-instantsearch";
import { NzCardModule } from "ng-zorro-antd/card";
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzNotificationModule } from 'ng-zorro-antd/notification';
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzSkeletonModule } from "ng-zorro-antd/skeleton";
import { NzTagModule } from "ng-zorro-antd/tag";
import { InfiniteScrollModule } from "ngx-infinite-scroll";
import { RefinementListComponent } from "src/app/@algolia/refinement/refinement.component";
import { SearchBoxComponent } from "src/app/@algolia/search/search.component";
import { SortByComponent } from "src/app/@algolia/sort/sort.component";
import { VisibleDirective } from "src/app/@algolia/visible.directive";
import { AlgoliaService } from "./services/algolia.service";

@NgModule({
  imports: [CommonModule, HttpClientModule, NzNotificationModule,
    CommonModule,
    NzCardModule,
    NzInputModule,
    DropdownTabsModule,
    MobileSearchModule,
    TabsModule,
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
    NgAisModule,
    NzCollapseModule,
    TokenRowModule,
    NgAisModule.forRoot(),

  ],
  declarations: [SearchBoxComponent, SortByComponent, RefinementListComponent, VisibleDirective,
  ],
  providers: [AlgoliaService],
  exports: [SearchBoxComponent, SortByComponent, RefinementListComponent, NgAisModule, NzCollapseModule, VisibleDirective]
})
export class AlgoliaModule {}
