import {Component, Inject, forwardRef, Optional, Input} from '@angular/core';
import { TypedBaseWidget, NgAisInstantSearch, NgAisIndex } from 'angular-instantsearch';

import connectRefinementList, {
  RefinementListWidgetDescription,
  RefinementListConnectorParams
} from 'instantsearch.js/es/connectors/refinement-list/connectRefinementList';
import {DeviceService} from "@core/services/device";

export type Mappings = { [v: string] : string };

@Component({
  selector: 'app-refinement-list',
  template: `
    <ul class="ais-RefinementList-list">
      <li class="ais-RefinementList-item" *ngFor="let item of state.items">
         <label>
           <input type="checkbox" class="ais-RefinementList-checkbox"
             (click)="state.refine(item.value)"
             [checked]="item.isRefined" />
           <span class="ais-RefinementList-labelText">
             {{ convertLabel(item.label) }}
           </span>
           <span class="ais-RefinementList-count">
             {{ item.count }}
           </span>
         </label>
      </li>
    </ul>
`
})

export class RefinementList extends TypedBaseWidget<RefinementListWidgetDescription, RefinementListConnectorParams> {

  @Input() attribute!: string;
  @Input() mapping?: Mappings;

  public state: RefinementListWidgetDescription['renderState'] = {
    canRefine: false,
    canToggleShowMore: false,
    createURL(value: string): string {return "";},
    hasExhaustiveItems: false,
    isFromSearch: false,
    isShowingMore: false,
    items: [],
    sendEvent: {} as any,
    refine(value: string): void {},
    searchForItems(query: string): void {},
    toggleShowMore(): void {}
  };

  constructor(
    @Inject(forwardRef(() => NgAisIndex))
    @Optional()
    public parentIndex: NgAisIndex,
    @Inject(forwardRef(() => NgAisInstantSearch))
    public instantSearchInstance: NgAisInstantSearch,
    public deviceService: DeviceService,
  ) {
    super('RefinementList');
  }
  ngOnInit() {
    this.createWidget(connectRefinementList, {
      // instance options
      attribute: this.attribute,
    });
    super.ngOnInit();
  }
  convertLabel(value: string): string {
    if (!this.mapping) {
      return value
    }
    return this.mapping[value] || value ;
  }
}
