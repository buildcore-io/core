import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { Timestamp } from '@functions/interfaces/models/base';
import { Nft } from '@functions/interfaces/models/nft';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/nft/services/data.service';
import { BehaviorSubject, interval } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-nft-countdown',
  templateUrl: './nft-countdown.component.html',
  styleUrls: ['./nft-countdown.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftCountdownComponent implements OnInit {
  @Input() ticker$: BehaviorSubject<Timestamp | undefined> = new BehaviorSubject<Timestamp | undefined>(undefined);
  @Input() wrapperClassName = '';
  @Input() tabClassName = '';
  @Input() size: 'large' | 'small' = 'large';

  constructor(
    public data: DataService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    interval(1000).pipe(untilDestroyed(this)).subscribe(() => {
      this.cd.markForCheck()
    });
  }

  public getCountdownTitle(nft?: Nft | null): string {
    if (this.data.isDateInFuture(nft?.availableFrom)) {
      return $localize`Sale Starts`;
    }
    if (this.data.isDateInFuture(nft?.auctionFrom)) {
      return $localize`Auction Starts`;
    }
    if (this.data.isDateInFuture(nft?.auctionTo)) {
      return $localize`Auction Ends`;
    }
    return '';
  }
}
