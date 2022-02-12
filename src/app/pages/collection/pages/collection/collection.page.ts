import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DeviceService } from '@core/services/device';
import { HOT_TAGS } from '@pages/market/pages/nfts/nfts.page';
import { FilterService } from '@pages/market/services/filter.service';
import { Nft } from 'functions/interfaces/models/nft';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'wen-collection',
  templateUrl: './collection.page.html',
  styleUrls: ['./collection.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionPage {
  public nft$: BehaviorSubject<Nft[]|undefined> = new BehaviorSubject<Nft[]|undefined>(undefined);
  public isAboutCollectionVisible = false;
  public sortControl: FormControl;
  public filterControl: FormControl;
  public hotTags: string[] = [HOT_TAGS.ALL, HOT_TAGS.AVAILABLE, HOT_TAGS.SOLD];
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.ALL]);

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
    this.filterControl = new FormControl('');
  }
  
  public handleChange(tag: string): void {
    this.selectedTags$.next([tag]);
  }

  public approve(): void {
    // Needs to be implemented
  }

  public onScroll(): void {
    // Needs to be implemented
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }
  
  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}