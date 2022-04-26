import { Injectable } from "@angular/core";
import { OffersHistory, SuccesfullOrdersWithFullHistory } from "@api/nft.api";
import { AuthService } from "@components/auth/services/auth.service";
import { SelectCollectionOption } from "@components/collection/components/select-collection/select-collection.component";
import { DescriptionItem } from "@components/description/description.component";
import { UnitsHelper } from "@core/utils/units-helper";
import { Timestamp } from "@functions/interfaces/models/base";
import * as dayjs from 'dayjs';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { Collection, Member, Space, Transaction } from "functions/interfaces/models";
import { Nft, PropStats } from "functions/interfaces/models/nft";
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
  public pastBidTransactions$: BehaviorSubject<Transaction[]> = new BehaviorSubject<Transaction[]>([]);
  public pastBidTransactionsLoading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public myBidTransactions$: BehaviorSubject<Transaction[]> = new BehaviorSubject<Transaction[]>([]);
  public myBidTransactionsLoading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public allBidTransactions$: BehaviorSubject<OffersHistory[]> = new BehaviorSubject<OffersHistory[]>([]);
  public allBidTransactionsLoading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
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

  public getPropStats(obj: PropStats | undefined = {}): DescriptionItem[] {
    if (!obj) {
      return [];
    }

    const final: any[] = [];
    for (const v of Object.values(obj).sort(function(a: any, b: any) {
      if (a.label < b.label) { return -1; }
      if (a.label > b.label) { return 1; }
      return 0;
    })) {
      final.push({ title: v.label, value: v.value });
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

  public getActionStart(nft?: Nft | null): dayjs.Dayjs | undefined {
    if (!nft?.auctionFrom) {
      return;
    }

    return dayjs(nft.auctionFrom.toDate());
  }

  public getSaleStart(nft?: Nft | null): dayjs.Dayjs | undefined {
    if (!nft?.availableFrom) {
      return;
    }

    return dayjs(nft.availableFrom.toDate());
  }

  public getCountdownDate(nft?: Nft | null): dayjs.Dayjs | undefined {
    if (this.isDateInFuture(nft?.availableFrom)) {
      return this.getSaleStart(nft);
    }
    if (this.isDateInFuture(nft?.auctionFrom)) {
      return this.getActionStart(nft);
    }
    if (this.isDateInFuture(nft?.auctionTo)) {
      return this.getAuctionEnd(nft);
    }
    return undefined;
  }

  public getCountdownDays(nft?: Nft | null): number {
    const date = this.getCountdownDate(nft);
    if (!date) {
      return 0;
    }

    return date.diff(dayjs(), 'days');
  }

  public getCountdownHours(nft?: Nft | null): number {
    const date = this.getCountdownDate(nft);
    if (!date) {
      return 0;
    }

    let hours = date.diff(dayjs(), 'hour');
    const days = Math.floor(hours / 24);
    hours = hours - (days * 24);
    return hours;
  }

  public getCountdownMin(nft?: Nft | null): number {
    const date = this.getCountdownDate(nft);
    if (!date) {
      return 0;
    }

    let minutes = date.diff(dayjs(), 'minute');
    const hours = Math.floor(minutes / 60);
    minutes = minutes - (hours * 60);
    return minutes;
  }

  public getCountdownSec(nft?: Nft | null): number {
    const date = this.getCountdownDate(nft);
    if (!date) {
      return 0;
    }

    let seconds = date.diff(dayjs(), 'seconds');
    const minutes = Math.floor(seconds / 60);
    seconds = seconds - (minutes * 60);
    return seconds;
  }

  public isDateInFuture(date?: Timestamp | null): boolean {
    if (!date) {
      return false;
    }

    return dayjs(date.toDate()).isAfter(dayjs(), 's');
  }
}
