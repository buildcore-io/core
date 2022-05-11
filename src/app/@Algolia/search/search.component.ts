import {
  Component,
  Inject,
  forwardRef,
  Optional,
  ChangeDetectionStrategy,
  Input,
  ChangeDetectorRef, NgZone, OnInit, OnDestroy
} from '@angular/core';
import { TypedBaseWidget, NgAisInstantSearch, NgAisIndex } from 'angular-instantsearch';

import connectSearchBox, {
  SearchBoxWidgetDescription,
  SearchBoxConnectorParams
} from 'instantsearch.js/es/connectors/search-box/connectSearchBox';
import {DeviceService} from "@core/services/device";
import {FormControl} from "@angular/forms";
import {TabSection} from "@components/tabs/tabs.component";
import {debounceTime} from "rxjs";
import {GLOBAL_DEBOUNCE_TIME} from "@functions/interfaces/config";
import {UntilDestroy, untilDestroyed} from "@ngneat/until-destroy";
import {NavigationEnd, Router} from "@angular/router";


@UntilDestroy()
@Component({
  selector: 'wen-search-box',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default
})
export class SearchBoxComponent extends TypedBaseWidget<SearchBoxWidgetDescription, SearchBoxConnectorParams> implements OnInit {
  @Input() sections: TabSection[] = [];

  public state: SearchBoxWidgetDescription['renderState'] = {
    clear(): void { /* */},
    isSearchStalled: false,
    query: '',
    refine(value: string): void { /* */},
  }
  public filterControl: FormControl = new FormControl(undefined);
  public selectedSection?: TabSection;
  public isSearchInputFocused = false;

  constructor(
    @Inject(forwardRef(() => NgAisIndex))
    // eslint-disable-next-line new-cap
    @Optional()
    public parentIndex: NgAisIndex,
    @Inject(forwardRef(() => NgAisInstantSearch))
    public instantSearchInstance: NgAisInstantSearch,
    public deviceService: DeviceService,
    private cd: ChangeDetectorRef,
    private router: Router,

    private ngZone: NgZone

  ) {
    super('SearchBox');
  }
  ngOnInit() {
    this.createWidget(connectSearchBox, {
      // instance options
    });
    // console.log('state=', this.state);
    this.filterControl.valueChanges.pipe(
      debounceTime(GLOBAL_DEBOUNCE_TIME),
      untilDestroyed(this)
    ).subscribe((val) => {
      this.state.refine(val);
    });

    this.setSelectedSection();

    this.router.events
      .pipe(untilDestroyed(this))
      .subscribe((obj) => {
        if (obj instanceof NavigationEnd) {
          this.setSelectedSection();
        }
      });

    super.ngOnInit();

  }

  private setSelectedSection() {
    console.log('setSelectedSection')
    this.selectedSection =
      this.sections.find((r: TabSection) =>
        (this.router.url || '').includes((r.route instanceof Array ? r.route : [r.route]).join('/').toLowerCase().substring(3)));
  }
}
