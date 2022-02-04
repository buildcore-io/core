import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { SelectSpaceOption } from '@components/select-space/select-space.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import { FilterService } from '@pages/market/services/filter.service';
import { Space } from 'functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';

export enum HOT_TAGS {
  ALL = 'All',
  AVAILABLE = 'Available',
  SOLD = 'Sold'
}

@Component({
  selector: 'wen-nfts',
  templateUrl: './nfts.page.html',
  styleUrls: ['./nfts.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NFTsPage {
  public sortControl: FormControl;
  public spaceControl: FormControl;
  public hotTags: string[] = [HOT_TAGS.ALL, HOT_TAGS.AVAILABLE, HOT_TAGS.SOLD];
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.ALL]);

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    public cache: CacheService,
    private storageService: StorageService
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
    this.spaceControl = new FormControl(this.storageService.selectedSpace.getValue());
  }
  
  public handleChange(tag: string): void {
    this.selectedTags$.next([tag]);
  }

  public getSpaceListOptions(list?: Space[] | null): SelectSpaceOption[] {
    return (list || []).map((o) => ({
        label: o.name || o.uid,
        value: o.uid,
        img: o.avatarUrl
    }));
  }
}