import { Injectable } from '@angular/core';
import { enumToArray } from '@core/utils/manipulations.utils';
import { Categories, Collection, CollectionStatus, DiscountLine, Network, Transaction, TransactionType, TRANSACTION_AUTO_EXPIRY_MS } from '@functions/interfaces/models';
import { Access, Timestamp } from '@functions/interfaces/models/base';
import dayjs from 'dayjs';

@Injectable({
  providedIn: 'root'
})
export class HelperService {

  public getDaysLeft(availableFrom?: Timestamp): number {
    if (!availableFrom) return 0;
    return dayjs(availableFrom.toDate()).diff(dayjs(new Date()), 'day');
  }

  public isAvailableForSale(col?: Collection|null): boolean {
    if (!col) {
      return false;
    }

    return ((col.total - col.sold) > 0) && this.isAvailable(col);
  }

  public isAvailable(col?: Collection|null): boolean {
    if (!col) {
      return false;
    }

    return col.approved === true && dayjs(col.availableFrom.toDate()).isBefore(dayjs());
  }

  public isLocked(col?: Collection|null): boolean {
    if (!col) {
      return true;
    }

    return ((col.approved == true && col.limitedEdition) || col.rejected == true);
  }

  public isDateInFuture(date?: Timestamp|null): boolean {
    if (!date) {
      return false;
    }

    return dayjs(date.toDate()).isAfter(dayjs());
  }

  public sortedDiscounts(discounts?: DiscountLine[] | null): DiscountLine[] {
    if (!discounts?.length) {
      return [];
    }

    return discounts.sort((a, b) => {
      return a.xp - b.xp;
    });
  }

  public getShareUrl(col?: Collection | null): string {
    const text = $localize`Check out collection`;
    const url: string = (col?.wenUrlShort || col?.wenUrl || window.location.href);
    return 'http://twitter.com/share?text= ' + text + ' &url=' + url + '&hashtags=soonaverse';
  }

  public isExpired(val?: Transaction | null): boolean {
    if (!val?.createdOn) {
      return false;
    }

    const expiresOn: dayjs.Dayjs = dayjs(val.createdOn.toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
    return expiresOn.isBefore(dayjs()) && val.type === TransactionType.ORDER;
  }

  public getCategory(category?: Categories): string {
    if (!category) {
      return '';
    }

    const categories = enumToArray(Categories);
    return categories.find(c => c.key === category).value;
  }

  public getAccessLabel(access?: Access | null): string {
    if (!access) {
      return '';
    }

    if (access === Access.GUARDIANS_ONLY) {
      return $localize`Guardians of Space Only`;
    } else if (access === Access.MEMBERS_ONLY) {
      return $localize`Members of Space Only`;
    } else if (access === Access.MEMBERS_WITH_BADGE) {
      return $localize`Members With Badge Only`;
    } else {
      return '';
    }
  }

  public isMinted(collection?: Collection | null): boolean {
    return collection?.status === CollectionStatus.MINTED;
  }

  public mintInProgress(collection?: Collection | null): boolean {
    return collection?.status === CollectionStatus.MINTING;
  }

  public getExplorerUrl(collection?: Collection | null): string {
    if (collection?.mintingData?.network === Network.RMS) {
      return 'https://explorer.shimmer.network/testnet/block/' + collection.mintingData.blockId;
    } else if (collection?.mintingData?.network === Network.IOTA) {
      return 'https://explorer.shimmer.network/testnet/block/' + collection.mintingData.blockId;
    } else if (collection?.mintingData?.network === Network.SMR) {
      return 'https://explorer.shimmer.network/testnet/block/' + collection.mintingData.blockId;
    } else if (collection?.mintingData?.network === Network.ATOI) {
      return 'https://explorer.shimmer.network/testnet/block/' + collection.mintingData.blockId;
    } else {
      return '';
    }
  }
}
