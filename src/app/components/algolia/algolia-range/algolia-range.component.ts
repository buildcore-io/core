import { Component, forwardRef, Inject, OnInit, Optional } from '@angular/core';
import { FormControl } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgAisIndex, NgAisInstantSearch, TypedBaseWidget } from 'angular-instantsearch';
import connectRange, {
  RangeConnectorParams, RangeWidgetDescription
} from 'instantsearch.js/es/connectors/range/connectRange';


@UntilDestroy()
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: 'wen-algolia-range',
  templateUrl: './algolia-range.component.html',
  styleUrls: ['./algolia-range.component.less']
})
export class AlgoliaRangeComponent extends TypedBaseWidget<RangeWidgetDescription, RangeConnectorParams> implements OnInit {
  public state?: RangeWidgetDescription['renderState']; // Rendering options
  public formControl = new FormControl([this.state?.range.min, this.state?.range.max]);
  constructor(
    @Inject(forwardRef(() => NgAisIndex))
    // eslint-disable-next-line new-cap
    @Optional()
    public parentIndex: NgAisIndex,
    @Inject(forwardRef(() => NgAisInstantSearch))
    public instantSearchInstance: NgAisInstantSearch
  ) {
    super('RangeSlider');
  }

  public ngOnInit(): void {
    this.createWidget(connectRange, {
      // instance options
      attribute: 'price',
    });
    super.ngOnInit();

    this.formControl.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe((val: [number, number]) => {
        console.log(val);
        this.state?.refine(val);
      });
  }
}
