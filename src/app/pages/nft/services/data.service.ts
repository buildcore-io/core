import { Injectable } from "@angular/core";
import { OffersHistory, SuccesfullOrdersWithFullHistory } from "@api/nft.api";
import { AuthService } from "@components/auth/services/auth.service";
import { SelectCollectionOption } from "@components/collection/components/select-collection/select-collection.component";
import { UnitsHelper } from "@core/utils/units-helper";
import * as dayjs from 'dayjs';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { Collection, Member, Space, Transaction } from "functions/interfaces/models";
import { Nft } from "functions/interfaces/models/nft";
import { BehaviorSubject } from "rxjs";
dayjs.extend(isSameOrBefore);

@Injectable({
  providedIn: 'any'
})
export class DataService {
  public nftId?: string;
  public nft$: BehaviorSubject<Nft | undefined> = new BehaviorSubject<Nft | undefined>(undefined);
  public collection$: BehaviorSubject<Collection | undefined> = new BehaviorSubject<Collection | undefined>(undefined);
  public topNftWithinCollection$: BehaviorSubject<Nft[] | undefined> = new BehaviorSubject<Nft[] | undefined>(undefined);
  public firstNftInCollection$: BehaviorSubject<Nft | undefined> = new BehaviorSubject<Nft | undefined>(undefined);
  public orders$: BehaviorSubject<SuccesfullOrdersWithFullHistory[] | undefined> = new BehaviorSubject<SuccesfullOrdersWithFullHistory[] | undefined>(undefined);
  public space$: BehaviorSubject<Space | undefined> = new BehaviorSubject<Space | undefined>(undefined);
  public royaltySpace$: BehaviorSubject<Space | undefined> = new BehaviorSubject<Space | undefined>(undefined);
  public creator$: BehaviorSubject<Member | undefined> = new BehaviorSubject<Member | undefined>(undefined);
  public owner$: BehaviorSubject<Member | undefined> = new BehaviorSubject<Member | undefined>(undefined);
  public collectionCreator$: BehaviorSubject<Member | undefined> = new BehaviorSubject<Member | undefined>(undefined);
  public myBidTransactions$: BehaviorSubject<Transaction[]> = new BehaviorSubject<Transaction[]>([]);
  public myBidTransactionsLoading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public allBidTransactions$: BehaviorSubject<OffersHistory[]> = new BehaviorSubject<OffersHistory[]>([]);
  public allBidTransactionsLoading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public myTransactions$: BehaviorSubject<Transaction[]> = new BehaviorSubject<Transaction[]>([]);
  public myTransactionsLoading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public constructor(private auth: AuthService) {
    // none.
  }

  public reset(): void {
    this.nftId = undefined;
    // this.nft$.next(undefined);
    // this.collection$.next(undefined);
    // this.topNftWithinCollection$.next(undefined);
    // this.firstNftInCollection$.next(undefined);
    // this.orders$.next(undefined);
    // this.space$.next(undefined);
    // this.royaltySpace$.next(undefined);
    // this.creator$.next(undefined);
    // this.owner$.next(undefined);
    // this.collectionCreator$.next(undefined);
  }


  public getCollectionListOptions(list?: Collection[] | null): SelectCollectionOption[] {
    return (list || [])
      .filter((o) => {
        if (!this.auth.member$.value) {
          return false;
        }

        return o.rejected !== true && o.createdBy === this.auth.member$.value.uid;
      })
      .map((o) => ({
        label: o.name || o.uid,
        value: o.uid
      }));
  }

  public getPropStats(obj: any): any[] {
    if (!obj) {
      return [];
    }

    const final: any[] = [];
    for (const v of Object.values(obj).sort(function(a: any, b: any) {
      if (a.label < b.label) { return -1; }
      if (a.label > b.label) { return 1; }
      return 0;
    })) {
      final.push(v);
    }

    return final;
  }

  public formatBest(amount?: number | null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
  }

  public auctionInProgress(nft?: Nft | null, col?: Collection | null): boolean {
    if (!col) {
      return false;
    }

    return (
      col.approved === true && !!nft?.auctionFrom && !!nft?.auctionTo &&
      dayjs(nft.auctionFrom.toDate()).isSameOrBefore(dayjs(), 's') &&
      dayjs(nft.auctionTo.toDate()).isAfter(dayjs(), 's')
    );
  }

  public getAuctionEnd(nft?: Nft | null): dayjs.Dayjs | undefined {
    if (!nft?.auctionTo) {
      return;
    }

    return dayjs(nft.auctionTo.toDate());
  }

  public getAuctionEndDays(nft?: Nft | null): number {
    const expiresOn = this.getAuctionEnd(nft);
    if (!expiresOn) {
      return 0;
    }

    return expiresOn.diff(dayjs(), 'days');
  }

  public getAuctionEndHours(nft?: Nft | null): number {
    const expiresOn = this.getAuctionEnd(nft);
    if (!expiresOn) {
      return 0;
    }

    let hours = expiresOn.diff(dayjs(), 'hour');
    const days = Math.floor(hours / 24);
    hours = hours - (days * 24);
    return hours;
  }

  public getAuctionEndMin(nft?: Nft | null): number {
    const expiresOn = this.getAuctionEnd(nft);
    if (!expiresOn) {
      return 0;
    }

    let minutes = expiresOn.diff(dayjs(), 'minute');
    const hours = Math.floor(minutes / 60);
    minutes = minutes - (hours * 60);
    return minutes;
  }

  public getAuctionEndSec(nft?: Nft | null): number {
    const expiresOn = this.getAuctionEnd(nft);
    if (!expiresOn) {
      return 0;
    }

    let seconds = expiresOn.diff(dayjs(), 'seconds');
    const minutes = Math.floor(seconds / 60);
    seconds = seconds - (minutes * 60);
    return seconds;
  }
}
