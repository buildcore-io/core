import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionFilter } from '@api/collection.api';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { DataService } from '@pages/space/services/data.service';
import { Collection } from 'functions/interfaces/models';
import { BehaviorSubject, Subscription } from 'rxjs';

@Component({
  selector: 'wen-collections',
  templateUrl: './collections.page.html',
  styleUrls: ['./collections.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionsPage implements OnInit, OnDestroy {
  public spaceId?: string;
  public selectedListControl: FormControl = new FormControl(CollectionFilter.ALL);
  public hotTags: { value: CollectionFilter; label: string}[] = [
    { value: CollectionFilter.ALL, label: 'All' },
    { value: CollectionFilter.PENDING, label: 'Pending' },
    { value: CollectionFilter.AVAILABLE, label: 'Available' }
  ];
  private subscriptions$: Subscription[] = [];

  constructor(
    public data: DataService,
    public deviceService: DeviceService,
    private cd: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  public ngOnInit(): void {
    this.route.parent?.params.subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.space.space.replace(':', '')];
      if (id) {
        this.cancelSubscriptions();
        this.spaceId = id;
      } else {
        this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
      }
    });
  }
  
  public handleFilterChange(filter: CollectionFilter): void {
    this.selectedListControl.setValue(filter);
    this.cd.markForCheck();
  }

  public get filterOptions(): typeof CollectionFilter {
    return CollectionFilter;
  }

  public create(): void {
    this.router.navigate([
      ('/' + ROUTER_UTILS.config.collection.root),
      ROUTER_UTILS.config.collection.new,
      { space: this.spaceId }
    ]);
  }

  public getList(): BehaviorSubject<Collection[]|undefined> {
    if (this.selectedListControl.value === this.filterOptions.ALL) {
      return this.data.allCollections$;
    } else if (this.selectedListControl.value === this.filterOptions.AVAILABLE) {
      return this.data.availableCollections$;
    } else if (this.selectedListControl.value === this.filterOptions.PENDING) {
      return this.data.pendingCollections$;
    }
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
