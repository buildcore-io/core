import {Component, Inject, forwardRef, Optional, ChangeDetectionStrategy, Input} from '@angular/core';
import { TypedBaseWidget, NgAisInstantSearch, NgAisIndex } from 'angular-instantsearch';

import connectSearchBox, {
  SearchBoxWidgetDescription,
  SearchBoxConnectorParams
} from 'instantsearch.js/es/connectors/search-box/connectSearchBox';
import {DeviceService} from "@core/services/device";
import {FormControl} from "@angular/forms";
import {TabSection} from "@components/tabs/tabs.component";
import {ROUTER_UTILS} from "@core/utils/router.utils";
import {debounceTime} from "rxjs";
import {GLOBAL_DEBOUNCE_TIME} from "@functions/interfaces/config";
import {UntilDestroy, untilDestroyed} from "@ngneat/until-destroy";
import {NavigationEnd, Router} from "@angular/router";

@UntilDestroy()
@Component({
  selector: 'app-search-box',
  template: `
    <div class="flex items-center">
      <wen-tabs *ngIf="deviceService.isDesktop$ | async" [tabs]="sections" class="mr-10"></wen-tabs>
      <wen-dropdown-tabs
        *ngIf="(deviceService.isMobile$ | async) && !isSearchInputFocused"
        [tabs]="sections"
        [selectedTab]="selectedSection">
      </wen-dropdown-tabs>

      <wen-mobile-search *ngIf="deviceService.isMobile$ | async" [formControl]="filterControl" class="ml-auto" i18n-placeholder placeholder="Search">
      </wen-mobile-search>

      <nz-input-group *ngIf="deviceService.isDesktop$ | async"
                      nzSize="large" [nzPrefix]="prefixIconSearch"
                      class="mr-8 border-inputs-border dark:border-inputs-border-dark shadow-none outline-0" nzSearch>
        <input
          type="text"
          [value]="this.state.query"
          type="text" nz-input i18n-placeholder placeholder="Spaces, awards, proposals or members..."
          class="text-base bg-inputs-background dark:bg-inputs-background-dark"
          [formControl]="filterControl"/>
      </nz-input-group>

      <ng-template #prefixIconSearch>
        <i nz-icon nzType="search" class="text-xl"></i>
      </ng-template>

    </div>
`,

})
export class SearchBox extends TypedBaseWidget<SearchBoxWidgetDescription, SearchBoxConnectorParams> {
  // oups.... TODO clean up this default parameter
  @Input() sections: TabSection[] = [
    { route: `../${ROUTER_UTILS.config.market.collections}`, label: $localize`Collections` },
    { route: `../${ROUTER_UTILS.config.market.nfts}`, label: $localize`NFT\'s` }
  ];

  public state: SearchBoxWidgetDescription['renderState'] = {
    clear(): void {},
    isSearchStalled: false,
    query: '',
    refine(value: string): void {},
  }
  public filterControl: FormControl = new FormControl(undefined);
  public selectedSection?: TabSection;
  public isSearchInputFocused = false;

  constructor(
    @Inject(forwardRef(() => NgAisIndex))
    @Optional()
    public parentIndex: NgAisIndex,
    @Inject(forwardRef(() => NgAisInstantSearch))
    public instantSearchInstance: NgAisInstantSearch,
    public deviceService: DeviceService,

  ) {
    super('SearchBox');
  }
  ngOnInit() {
    this.createWidget(connectSearchBox, {
      // instance options
    });
    console.log('state=', this.state);
    this.filterControl.valueChanges.pipe(
      debounceTime(GLOBAL_DEBOUNCE_TIME),
      untilDestroyed(this)
    ).subscribe((val) => {
      this.state.refine(val);
    });
    super.ngOnInit();

    // hacky way for now.... no need here in fact
    // this.router.events
    //   .pipe(untilDestroyed(this))
    //   .subscribe((obj) => {
    //     console.log('router events')
    //     if (obj instanceof NavigationEnd) {
    //       console.log('BINGO')
    //     }
    //   });
  }


}
