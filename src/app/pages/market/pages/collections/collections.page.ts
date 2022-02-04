import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DeviceService } from '@core/services/device';
import { FilterService } from '@pages/market/services/filter.service';
import { BehaviorSubject } from 'rxjs';

export enum HOT_TAGS {
  ALL = 'All',
  TRENDING = 'Trending',
  TOP = 'Top'
}

@Component({
  selector: 'wen-collections',
  templateUrl: './collections.page.html',
  styleUrls: ['./collections.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionsPage {
  public sortControl: FormControl;
  public hotTags: string[] = [HOT_TAGS.ALL, HOT_TAGS.TRENDING, HOT_TAGS.TOP];
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.ALL]);

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
  }
  
  public handleChange(tag: string): void {
    this.selectedTags$.next([tag]);
  }
}