import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DEFAULT_LIST_SIZE } from '@api/base.api';
import { DeviceService } from '@core/services/device';
import { Nft } from 'functions/interfaces/models/nft';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'wen-nfts',
  templateUrl: './nfts.page.html',
  styleUrls: ['./nfts.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NFTsPage {
  public collectionControl: FormControl;
  public filterControl: FormControl;
  public nft$: BehaviorSubject<Nft[]|undefined> = new BehaviorSubject<Nft[]|undefined>(undefined);
  private dataStore: Nft[][] = [];

  constructor(
    public deviceService: DeviceService
  ) {
    this.collectionControl = new FormControl('');
    this.filterControl = new FormControl('');
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.nft$.value) {
      return;
    }

    // We reached maximum.
    if ((!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE)) {
      return;
    }

    // Needs to be impelemented.
  }
}
