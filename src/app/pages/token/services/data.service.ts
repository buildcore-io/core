import { Injectable } from "@angular/core";
import { UnitsHelper } from "@core/utils/units-helper";
import { Space } from "@functions/interfaces/models";
import { Token, TokenDistribution, TokenStatus } from "@functions/interfaces/models/token";
import * as dayjs from 'dayjs';
import { BehaviorSubject } from "rxjs";

@Injectable({
  providedIn: 'any'
})
export class DataService {
  public token$: BehaviorSubject<Token | undefined> = new BehaviorSubject<Token | undefined>(undefined);
  public space$: BehaviorSubject<Space | undefined> = new BehaviorSubject<Space | undefined>(undefined);
  public memberDistribution$?: BehaviorSubject<TokenDistribution | undefined> = new BehaviorSubject<TokenDistribution | undefined>(undefined);

  public resetSubjects(): void {
    // Clean up all streams.
    this.token$.next(undefined);
    this.space$.next(undefined);
  }

  public formatBest(amount: number | undefined | null): string {
    if (!amount) {
      return '0 Mi';
    }

    return UnitsHelper.formatBest(Math.floor(Number(amount)), 2);
  }

  public percentageMarketCap(percentage: number, token?: Token): string {
    if (!token) {
      return '';
    }
    return this.formatBest(Math.floor(token?.pricePerToken * (token?.totalSupply * percentage / 100)));
  }

  public formatTokenBest(amount?: number|null): string {
    if (!amount) {
      return '0';
    }

    return (amount / 1000 / 1000).toFixed(2);
  }

  public saleEndDate(token?: Token): dayjs.Dayjs {
    return dayjs(token?.saleStartDate?.toDate()).add(token?.saleLength || 0, 'ms');
  }

  public isInProcessing(token?: Token): boolean {
    return token?.status === TokenStatus.PROCESSING;
  }

  public isScheduledForSale(token?: Token): boolean {
    return (
      !!token?.approved &&
      (token?.status === TokenStatus.AVAILABLE || token?.status === TokenStatus.PROCESSING) &&
      !!token?.saleStartDate
    );
  }

  public isAfterSaleStarted(token?: Token): boolean {
    return (
      !!token?.approved &&
      dayjs(token?.saleStartDate?.toDate()).isBefore(dayjs())
    );
  }

  public isProcessing(token?: Token): boolean {
    return token?.status === TokenStatus.PROCESSING;
  }

  public isInCooldown(token?: Token): boolean {
    return (
      !!token?.approved &&
      (token?.status === TokenStatus.AVAILABLE || token?.status === TokenStatus.PROCESSING) &&
      dayjs(token?.coolDownEnd?.toDate()).isAfter(dayjs()) &&
      dayjs(token?.saleStartDate?.toDate()).add(token?.saleLength || 0, 'ms').isBefore(dayjs())
    );
  }

  public isAvailableForSale(token?: Token): boolean {
    return (
      !!token?.approved &&
      token?.status === TokenStatus.AVAILABLE &&
      dayjs(token?.saleStartDate?.toDate()).isBefore(dayjs()) &&
      dayjs(token?.saleStartDate?.toDate()).add(token?.saleLength || 0, 'ms').isAfter(dayjs())
    );
  }

  public isSalesInProgress(token?: Token): boolean {
    return (
      !!token?.approved &&
      token?.status === TokenStatus.AVAILABLE &&
      dayjs(token?.saleStartDate?.toDate()).isBefore(dayjs()) &&
      dayjs(token?.coolDownEnd?.toDate()).isAfter(dayjs())
    );
  }
}
