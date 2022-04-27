import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DEFAULT_SPACE, SelectSpaceOption } from '@components/space/components/select-space/select-space.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import { Space } from '@functions/interfaces/models';
import { FilterService } from '@pages/market/services/filter.service';

export enum AddedCategories {
  ALL = 'All'
}

@Component({
  selector: 'wen-tokens',
  templateUrl: './tokens.page.html',
  styleUrls: ['./tokens.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokensPage {
  public sortControl: FormControl;
  public spaceControl: FormControl;
  public statusControl: FormControl;
  public statuses: string[] = [AddedCategories.ALL];

  constructor(
    public deviceService: DeviceService,
    public cache: CacheService,
    public filter: FilterService,
    private storageService: StorageService
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
    this.spaceControl = new FormControl(this.storageService.selectedSpace.getValue() || DEFAULT_SPACE.value);
    this.statusControl = new FormControl(AddedCategories.ALL);
  }

  public getSpaceListOptions(list?: Space[] | null): SelectSpaceOption[] {
    return (list || []).map((o) => ({
      label: o.name || o.uid,
      value: o.uid,
      img: o.avatarUrl
    }));
  }

  // TODO: needs to be implemented
  public onScroll(): void {
    return;
  }
}
