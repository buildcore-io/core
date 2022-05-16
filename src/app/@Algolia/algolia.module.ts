import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NzNotificationModule } from 'ng-zorro-antd/notification';
import {NzCardModule} from "ng-zorro-antd/card";
import {NzInputModule} from "ng-zorro-antd/input";
import {DropdownTabsModule} from "@components/dropdown-tabs/dropdown-tabs.module";
import {MobileSearchModule} from "@components/mobile-search/mobile-search.module";
import {TabsModule} from "@components/tabs/tabs.module";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzTagModule} from "ng-zorro-antd/tag";
import {NzSelectModule} from "ng-zorro-antd/select";
import {IconModule} from "@components/icon/icon.module";
import {SelectSpaceModule} from "@components/space/components/select-space/select-space.module";
import {CollectionCardModule} from "@components/collection/components/collection-card/collection-card.module";
import {InfiniteScrollModule} from "ngx-infinite-scroll";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {NftCardModule} from "@components/nft/components/nft-card/nft-card.module";
import {NgAisModule} from "angular-instantsearch";
import {NzCollapseModule} from "ng-zorro-antd/collapse";
import {TokenRowModule} from "@components/token/components/token-row/token-row.module";
import {AlgoliaService} from "./services/algolia.service";
import {VisibleDirective} from "@Algolia/visible.directive";
import {SortByComponent} from "@Algolia/sort/sort.component";
import {SearchBoxComponent} from "@Algolia/search/search.component";
import {RefinementListComponent} from "@Algolia/refinement/refinement.component";

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
