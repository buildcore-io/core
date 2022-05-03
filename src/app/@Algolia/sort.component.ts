import {
  Component,
  Inject,
  forwardRef,
  Optional,
  Input,
  ChangeDetectorRef,
  NgZone, ChangeDetectionStrategy, OnInit
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
  template: `
    <ng-template #defaultTemplate let-selected>
      <div class="flex items-center">
        <div nz-typography nzType="secondary" class="mr-1 text-xs">
          <ng-container *ngIf="selected.nzLabel === 'Recent'; else notRecent" i18n>Sort by</ng-container>
          <ng-template #notRecent i18n>Price</ng-template>
        </div>
        <span>{{ selected.nzLabel }}</span>
      </div>
    </ng-template>
<nz-select   #select class="mt-6 wen-sort-button xl:mt-0" i18n-nzPlaceHolder nzPlaceHolder="Sort by" [nzCustomTemplate]="defaultTemplate"
             [formControl]="sortControl" nz-tooltip>
(ngModelChange)="state.refine($event)">
  <nz-option *ngFor="let option of state.options" [nzValue]="option.value" [nzLabel]="option.label">
    {{ option.label }}
  </nz-option>
</nz-select>
`,
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.OnPush


})
export class SortByComponent extends TypedBaseWidget<SortByWidgetDescription, SortByConnectorParams> implements OnInit {

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
    private cd: ChangeDetectorRef,
    private ngZone: NgZone

  ) {
    super('SortBy');
    this.sortControl = new FormControl();
    this.sortControl.valueChanges.pipe(untilDestroyed(this))
      .subscribe((val: any) => {
        this.state.refine(val);

      });

  }
  ngOnInit() {
    this.createWidget(connectSortBy, {
      // instance options
      items: this.items,
    });
    super.ngOnInit();
  }
}
