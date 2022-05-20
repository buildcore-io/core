import { ChangeDetectionStrategy, Component, forwardRef, Inject, Input, OnInit, Optional } from '@angular/core';
import { noop, parseNumberInput } from "@components/algolia/util";
import { NgAisIndex, NgAisInstantSearch, TypedBaseWidget } from 'angular-instantsearch';
import { connectRefinementList } from 'instantsearch.js/es/connectors';
import {
  RefinementListConnectorParams, RefinementListItem, RefinementListRenderState, RefinementListWidgetDescription
} from 'instantsearch.js/es/connectors/refinement-list/connectRefinementList';

@Component({
  selector: 'wen-algolia-checkbox',
  templateUrl: './algolia-checkbox.component.html',
  styleUrls: ['./algolia-checkbox.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AlgoliaCheckboxComponent extends TypedBaseWidget<
    RefinementListWidgetDescription,
    RefinementListConnectorParams
  > implements OnInit {
  // rendering options
  @Input() public showMoreLabel = 'Show more';
  @Input() public showLessLabel = 'Show less';
  @Input() public searchable?: boolean;
  @Input() public searchPlaceholder = 'Search here...';

  // instance options
  @Input() public attribute!: RefinementListConnectorParams['attribute'];
  @Input() public operator: RefinementListConnectorParams['operator'];
  @Input() public limit: RefinementListConnectorParams['limit'];
  @Input() public showMore: RefinementListConnectorParams['showMore'];
  @Input() public showMoreLimit: RefinementListConnectorParams['showMoreLimit'];
  @Input() public sortBy: RefinementListConnectorParams['sortBy'];
  @Input()
  public transformItems?: RefinementListConnectorParams['transformItems'];
  @Input() public showIcon=true;

  public state: RefinementListRenderState = {
    canRefine: false,
    canToggleShowMore: false,
    createURL: () => '',
    isShowingMore: false,
    items: [],
    refine: noop,
    toggleShowMore: noop,
    searchForItems: noop,
    isFromSearch: false,
    hasExhaustiveItems: false,
    sendEvent: noop,
  };

  get isHidden() {
    return this.state.items.length === 0 && this.autoHideContainer;
  }

  constructor(
    @Inject(forwardRef(() => NgAisIndex))
    // eslint-disable-next-line new-cap
    @Optional()
    public parentIndex: NgAisIndex,
    @Inject(forwardRef(() => NgAisInstantSearch))
    public instantSearchInstance: NgAisInstantSearch
  ) {
    super('RefinementList');
  }

  public ngOnInit() {
    this.createWidget(connectRefinementList, {
      showMore: this.showMore,
      limit: parseNumberInput(this.limit),
      showMoreLimit: parseNumberInput(this.showMoreLimit),
      attribute: this.attribute,
      operator: this.operator,
      sortBy: this.sortBy,
      escapeFacetValues: true,
      transformItems: this.transformItems,
    });

    super.ngOnInit();
  }

  public refine(event: MouseEvent, item: RefinementListItem) {
    event.preventDefault();
    event.stopPropagation();

    if (this.state.canRefine) {
      // update UI directly, it will update the checkbox state
      item.isRefined = !item.isRefined;

      // refine through Algolia API
      this.state.refine(item.value);
    }
  }
}
