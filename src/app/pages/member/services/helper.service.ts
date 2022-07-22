import { Injectable } from '@angular/core';
import { SelectCollectionOption } from '@components/collection/components/select-collection/select-collection.component';
import { SelectSpaceOption } from '@components/space/components/select-space/select-space.component';
import { Units, UnitsHelper } from '@core/utils/units-helper';
import { Collection, Space } from '@functions/interfaces/models';
import { Token, TokenDrop, TokenStatus } from '@functions/interfaces/models/token';
import dayjs from 'dayjs';

@Injectable({
  providedIn: 'root'
})
export class HelperService {
  public preMinted(token: Token): boolean {
    return token.status === TokenStatus.PRE_MINTED;
  }

  public isMinted(token: Token): boolean {
    return token.status === TokenStatus.MINTED;
  }

  public salesInProgressOrUpcoming(token: Token): boolean {
    return (
      !!token.saleStartDate &&
      dayjs(token.saleStartDate?.toDate()).isBefore(dayjs()) &&
      token?.status !== TokenStatus.PRE_MINTED &&
      token?.approved
    );
  }

  public vestingInFuture(drop: TokenDrop): boolean {
    return dayjs(drop.vestingAt.toDate()).isAfter(dayjs());
  }

  public isInCooldown(token?: Token): boolean {
    return (
      !!token?.approved &&
      (token?.status === TokenStatus.AVAILABLE || token?.status === TokenStatus.PROCESSING) &&
      dayjs(token?.coolDownEnd?.toDate()).isAfter(dayjs()) &&
      dayjs(token?.saleStartDate?.toDate()).add(token?.saleLength || 0, 'ms').isBefore(dayjs())
    );
  }

  public formatBest(amount: number | undefined | null): string {
    if (!amount) {
      return '0 Mi';
    }

    return UnitsHelper.formatUnits(Number(amount), <Units>'Mi');
  }

  public formatTokenBest(amount?: number|null): string {
    if (!amount) {
      return '0';
    }

    return (amount / 1000 / 1000).toFixed(6);
  }

  public getCollectionListOptions(list?: Collection[] | null): SelectCollectionOption[] {
    return (list || [])
      .filter((o) => o.rejected !== true)
      .map((o) => ({
        label: o.name || o.uid,
        value: o.uid,
        img: o.bannerUrl
      }));
  }

  public getSpaceListOptions(list?: Space[] | null): SelectSpaceOption[] {
    return (list || []).map((o) => ({
      label: o.name || o.uid,
      value: o.uid,
      img: o.avatarUrl
    }));
  }
}
