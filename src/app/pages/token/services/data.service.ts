import { Injectable } from "@angular/core";
import { UnitsHelper } from "@core/utils/units-helper";
import { Space } from "@functions/interfaces/models";
import { Token } from "@functions/interfaces/models/token";
import * as dayjs from 'dayjs';
import { BehaviorSubject } from "rxjs";

@Injectable({
  providedIn: 'any'
})
export class DataService {
  public token$: BehaviorSubject<Token | undefined> = new BehaviorSubject<Token | undefined>(undefined);
  public space$: BehaviorSubject<Space | undefined> = new BehaviorSubject<Space | undefined>(undefined);

  public resetSubjects(): void {
    // Clean up all streams.
    this.token$.next(undefined);
    this.space$.next(undefined);
  }

  public formatBest(amount: number | undefined | null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
  }

  public percentageMarketCap(percentage: number, token?: Token): string {
    if (!token) {
      return '';
    }
    return this.formatBest(token?.pricePerToken * token?.totalSupply / 100 * percentage);
  }

  public saleEndDate(token?: Token): dayjs.Dayjs {
    return dayjs(token?.saleStartDate?.toDate()).add(token?.saleLength || 0, 'ms');
  }
}