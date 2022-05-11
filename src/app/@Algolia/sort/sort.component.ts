import {
  Component,
  Inject,
  forwardRef,
  Optional,
  Input,
  ChangeDetectorRef,
  NgZone, ChangeDetectionStrategy, OnInit, AfterViewInit
} from '@angular/core';
import { TypedBaseWidget, NgAisInstantSearch, NgAisIndex } from 'angular-instantsearch';

import connectSortBy, {
  SortByWidgetDescription,
  SortByConnectorParams
} from 'instantsearch.js/es/connectors/sort-by/connectSortBy';
import {FormControl} from "@angular/forms";
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  selector: 'wen-sort-by',
  templateUrl: './sort.component.html',
  styleUrls: ['./sort.component.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default
})
export class SortByComponent extends TypedBaseWidget<SortByWidgetDescription, SortByConnectorParams> implements OnInit, AfterViewInit {

  @Input() items: any[] = [];

  public sortControl: FormControl;

  public state: SortByWidgetDescription['renderState'] = {
    currentRefinement: "", hasNoResults: false, initialIndex: "", options: [
    ],
    refine(value: string): void { /* */}
  }
  constructor(
    @Inject(forwardRef(() => NgAisIndex))

  // eslint-disable-next-line new-cap
  @Optional()
    public parentIndex: NgAisIndex,
    @Inject(forwardRef(() => NgAisInstantSearch))
    public instantSearchInstance: NgAisInstantSearch,
  ) {
    super('SortBy');
    this.sortControl = new FormControl();
  }
  ngOnInit() {
    this.createWidget(connectSortBy, {
      // instance options
      items: this.items,
    });
    super.ngOnInit();
  }
  ngAfterViewInit() {
    this.sortControl.setValue(this.items && this.items.length > 0 ? this.items[0].value : '');
    this.sortControl.valueChanges.pipe(untilDestroyed(this))
      .subscribe((val: any) => {
        this.state.refine(val);
      });
  }
}
