import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { SelectSpaceOption } from '@components/select-space/select-space.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import { FilterService } from '@pages/discover/services/filter.service';
import { Space } from 'functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';

export enum HOT_TAGS {
  ALL = 'All',
  COLLECTIBLES = 'Collectibles',
  COMMUNITY_DROPS = 'CommunityDrops',
  GENERATED = 'Generated'
}

@Component({
  selector: 'wen-collections',
  templateUrl: './collections.page.html',
  styleUrls: ['./collections.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionsPage {
  public sortControl: FormControl;
  public spaceControl: FormControl;
  public hotTags: string[] = [HOT_TAGS.ALL, HOT_TAGS.COLLECTIBLES, HOT_TAGS.COMMUNITY_DROPS, HOT_TAGS.GENERATED];
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