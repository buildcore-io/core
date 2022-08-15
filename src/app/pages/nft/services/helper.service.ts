import { Injectable } from '@angular/core';
import { SuccesfullOrdersWithFullHistory } from '@api/nft.api';
import { DescriptionItem } from '@components/description/description.component';
import { Collection, Transaction, TransactionBillPayment, TransactionType, TRANSACTION_AUTO_EXPIRY_MS } from '@functions/interfaces/models';
import { Timestamp } from '@functions/interfaces/models/base';
import { Nft, PropStats } from '@functions/interfaces/models/nft';
import * as dayjs from 'dayjs';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrBefore);

@Injectable({
  providedIn: 'root'
})
export class HelperService {

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

  public isDateInFuture(date?: Timestamp | null): boolean {
    if (!date || !date.toDate) {
      return false;
    }

    return dayjs(date?.toDate()).isAfter(dayjs(), 's');
  }

  public getDaysLeft(availableFrom?: Timestamp | null): number {
    if (!this.getDate(availableFrom)) return 0;
    return dayjs(this.getDate(availableFrom)).diff(dayjs(new Date()), 'day');
  }

  public getDate(date: any): any {
    if (typeof date === 'object' && date?.toDate) {
      return date.toDate();
    } else {
      return date || undefined;
    }
  }

  public getCountdownTitle(nft?: Nft | null): string {
    if (this.isDateInFuture(nft?.availableFrom)) {
      return $localize`Sale Starts`;
    }
    if (this.isDateInFuture(nft?.auctionFrom)) {
      return $localize`Auction Starts`;
    }
    if (this.isDateInFuture(nft?.auctionTo)) {
      return $localize`Auction Ends`;
    }
    return '';
  }

  public getShareUrl(nft?: Nft | null): string {
    return nft?.wenUrlShort || nft?.wenUrl || window.location.href;
  }

  public isAvailableForSale(nft?: Nft | null, col?: Collection | null): boolean {
    if (!col) {
      return false;
    }

    return (col.approved === true && !!nft?.availableFrom && dayjs(nft.availableFrom.toDate()).isSameOrBefore(dayjs(), 's'));
  }

  public willBeAvailableForSale(nft?: Nft | null, col?: Collection | null): boolean {
    if (!col) {
      return false;
    }

    return col.approved === true && !!nft?.availableFrom && dayjs(nft.availableFrom.toDate()).isAfter(dayjs(), 's');
  }

  public canBeSetForSale(nft?: Nft | null): boolean {
    if (nft?.auctionFrom || nft?.availableFrom) {
      return false;
    }

    return !!nft?.owner;
  }

  public isAvailableForAuction(nft?: Nft | null, col?: Collection | null): boolean {
    if (!col || !nft?.auctionFrom) {
      return false;
    }

    return col.approved === true && !!nft?.auctionFrom && dayjs(nft.auctionFrom.toDate()).isSameOrBefore(dayjs(), 's');
  }

  public willBeAvailableForAuction(nft?: Nft | null, col?: Collection | null): boolean {
    if (!col) {
      return false;
    }

    return col.approved === true && !!nft?.auctionFrom && dayjs(nft.auctionFrom.toDate()).isAfter(dayjs(), 's');
  }

  public saleNotStartedYet(nft?: Nft | null): boolean {
    if (!nft || !nft.availableFrom) {
      return false;
    }

    return dayjs(nft.availableFrom.toDate()).isAfter(dayjs(), 's')
  }

  public getExplorerLink(link?: string | null): string {
    return 'https://thetangle.org/search/' + link;
  }

  public getOnChainInfo(orders?: SuccesfullOrdersWithFullHistory[] | null): string | undefined {
    if (!orders) {
      return undefined;
    }

    const lastestBill: TransactionBillPayment | undefined = this.getLatestBill(orders);
    return lastestBill?.payload?.chainReference || lastestBill?.payload?.walletReference?.chainReference || undefined;
  }

  public getLatestBill(orders?: SuccesfullOrdersWithFullHistory[] | null): TransactionBillPayment | undefined {
    if (!orders) {
      return undefined;
    }

    // Get all non royalty bills.
    let lastestBill: TransactionBillPayment | undefined = undefined;
    for (const h of orders) {
      for (const l of (h.transactions || [])) {
        if (
          l.type === TransactionType.BILL_PAYMENT &&
          l.payload.royalty === false &&
          l.payload.reconciled === true &&
          (!lastestBill || dayjs(lastestBill.createdOn?.toDate()).isBefore(l.createdOn?.toDate()))
        ) {
          lastestBill = l;
        }
      }
    }

    return lastestBill;
  }

  public isExpired(val?: Transaction | null): boolean {
    if (!val?.createdOn) {
      return false;
    }

    const expiresOn: dayjs.Dayjs = dayjs(val.createdOn.toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
    return expiresOn.isBefore(dayjs()) && val.type === TransactionType.ORDER;
  }
}
