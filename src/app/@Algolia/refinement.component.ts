import {
  Component,
  Inject,
  forwardRef,
  Optional,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy
} from '@angular/core';
import { TypedBaseWidget, NgAisInstantSearch, NgAisIndex } from 'angular-instantsearch';

import connectRefinementList, {
  RefinementListWidgetDescription,
  RefinementListConnectorParams
} from 'instantsearch.js/es/connectors/refinement-list/connectRefinementList';
import {DeviceService} from "@core/services/device";

export type RefinementMappings = { [v: string]: string };

@Component({
  selector: 'wen-refinement-list',
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
`,
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default

})

export class RefinementListComponent extends TypedBaseWidget<RefinementListWidgetDescription, RefinementListConnectorParams> implements OnInit {

  @Input() attribute!: string;
  @Input() mapping?: RefinementMappings;

  public state: RefinementListWidgetDescription['renderState'] = {
    canRefine: false,
    canToggleShowMore: false,
    createURL(value: string): string {return "";},
    hasExhaustiveItems: false,
    isFromSearch: false,
    isShowingMore: false,
    items: [],
    sendEvent: {} as any,
    refine(value: string): void {/**/},
    searchForItems(query: string): void {/**/},
    toggleShowMore(): void { /**/}
  };

  constructor(
    @Inject(forwardRef(() => NgAisIndex))
    // eslint-disable-next-line new-cap
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
