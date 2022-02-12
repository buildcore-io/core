import { ChangeDetectionStrategy, Component } from '@angular/core';
import { copyToClipboard } from '@core/utils/tools.utils';
import { Nft } from 'functions/interfaces/models/nft';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'wen-nft',
  templateUrl: './nft.page.html',
  styleUrls: ['./nft.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NFTPage {
  public nft$: BehaviorSubject<Nft[]|undefined> = new BehaviorSubject<Nft[]|undefined>(undefined);

  public buy(): void {
    // Needs to be implemented
  }

  public copy(): void {
    // Needs to be changed
    const text = '0x0';
    copyToClipboard(text);
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