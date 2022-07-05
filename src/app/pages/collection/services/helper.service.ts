import { Injectable } from '@angular/core';
import { enumToArray } from '@core/utils/manipulations.utils';
import { Units, UnitsHelper } from '@core/utils/units-helper';
import { Categories, Collection, DiscountLine } from '@functions/interfaces/models';
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

  public formatBest(amount?: number|null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatUnits(Number(amount), <Units>'Mi');
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
}
