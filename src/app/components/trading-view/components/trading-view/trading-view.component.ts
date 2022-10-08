import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input, OnInit,
  ViewChild
} from '@angular/core';
import { TokenPurchaseApi } from '@api/token_purchase.api';
import { TokenPurchase, TokenStatus } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import dayjs from 'dayjs';
import {
  CandlestickData, createChart, CrosshairMode, HistogramData, ISeriesApi, UTCTimestamp
} from 'lightweight-charts';
import { BehaviorSubject, Subscription } from 'rxjs';

export enum TRADING_VIEW_INTERVALS {
  '1h' = '1h',
  '4h' = '4h',
  '1d' = '1d',
  '1w' = '1w'
}

@UntilDestroy()
@Component({
  selector: 'wen-trading-view',
  templateUrl: './trading-view.component.html',
  styleUrls: ['./trading-view.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradingViewComponent implements OnInit, AfterViewInit {
  @Input()
  public set tokenId(value: string|undefined) {
    this._tokenId = value;
    this.refreshData();
  }
  @Input() public status?: TokenStatus;
  @Input()
  public set interval(value: TRADING_VIEW_INTERVALS) {
    this._interval = value;
    // Subscription for data already initiated.
    if (this.purchasesSubs$) {
      this.drawData();
    }
  }
  public get data(): TokenPurchase[] {
    return this._data;
  }

  @ViewChild('tradingView') tradingViewEleRef?: ElementRef<HTMLElement>;
  private candlestickSeries?: ISeriesApi<'Candlestick'>;
  private volumeSeries?: ISeriesApi<'Histogram'>;
  private _data: TokenPurchase[] = [];
  private _interval: TRADING_VIEW_INTERVALS = TRADING_VIEW_INTERVALS['1h'];
  private _tokenId?: string;
  public listenToPurchases$: BehaviorSubject<TokenPurchase[]> = new BehaviorSubject<TokenPurchase[]>([]);
  private purchasesSubs$?: Subscription;
  private timeLimit = 3600;

  constructor(
    public tokenPurchaseApi: TokenPurchaseApi
  ) {
    // none.
  }

  public ngOnInit(): void {
    this.refreshData();
    this.listenToPurchases$.subscribe(() => {
      this.drawData();
    });
  }

  public ngAfterViewInit(): void {
    // Great examples: https://www.tradingview.com/lightweight-charts/
    if (this.tradingViewEleRef) {
      const chart = createChart(this.tradingViewEleRef.nativeElement, {
        // TODO fixed width of div.
        width: 1000,
        height: 400,
        crosshair: {
          mode: CrosshairMode.Normal,
        },
      });
      this.candlestickSeries = chart.addCandlestickSeries();
      this.volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '',
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      // Maybe just one day.
      chart.timeScale().fitContent();
    }
  }

  private refreshData(): void {
    if (!this._tokenId || !this.status) return;
    this.purchasesSubs$?.unsubscribe();
    this.purchasesSubs$ = this.tokenPurchaseApi.listenToPurchases(this._tokenId, [this.status]).pipe(untilDestroyed(this)).subscribe(this.listenToPurchases$);
  }

  private drawData(): void {
    if (!this.listenToPurchases$.value?.length) {
      return;
    }

    const chartData: CandlestickData[] = [];
    const volumeData: HistogramData[] = [];
    this.setTimeLimit();
    const sortedList = this.listenToPurchases$.value.sort((a, b) => {
      return a.createdOn!.seconds - b.createdOn!.seconds;
    });

    let start = dayjs(sortedList[0].createdOn?.toDate()).hour(0).minute(0).second(0).millisecond(0);
    while (start.isBefore(dayjs())) {
      const next = start.add(this.timeLimit, 'second');
      const recordsWithinTime: TokenPurchase[] = this.listenToPurchases$.value.filter((o) => {
        return dayjs(o.createdOn!.toDate()).isAfter(start) && dayjs(o.createdOn!.toDate()).isSameOrBefore(next);
      });

      if (recordsWithinTime.length) {
        const max = Math.max(...recordsWithinTime.map(o => o.price));
        const min = Math.min(...recordsWithinTime.map(o => o.price));
        const sum = (recordsWithinTime.map(o => o.count).reduce((partialSum, a) => partialSum + a, 0)) / 1000 / 1000;
        chartData.push({
          time: next.unix() as UTCTimestamp,
          open: recordsWithinTime[0].price || 0,
          high: max || 0,
          low: min || 0,
          close: recordsWithinTime[recordsWithinTime.length - 1].price || 0
        });

        const green = 'rgba(0, 150, 136, 0.8)';
        const red = 'rgba(255,82,82, 0.8)';
        volumeData.push({
          time: next.unix() as UTCTimestamp,
          value: sum,
          color: (
            // Not sure this is correct.
            // chartData[chartData.length - 2] &&
            // in a given time frame, if the closing price is greater than the opening price,
            (chartData[chartData.length - 1].close > chartData[chartData.length - 1].open)
            // but the candle's closing price is lesser than the previous candle's closing price, you will get a green candlestick & a red volume bar.
            // && chartData[chartData.length - 1].close < chartData[chartData.length - 2].close
          ) ? red : green
        });
      }

      start = next;
    }

    if (this.candlestickSeries && chartData.length > 0) {
      this.candlestickSeries!.setData(chartData);
      this.volumeSeries!.setData(volumeData);
    }
  }

  private setTimeLimit(): void {
    const time = parseInt(this._interval.split('')[0], 10);
    const unit = this._interval.split('')[1];

    switch (unit) {
    case 'h':
      this.timeLimit = 3600 * time;
      break;
    case 'd':
      this.timeLimit = 3600 * 24 * time;
      break;
    case 'w':
      this.timeLimit = 3600 * 24 * 7 * time;
      break;
    }
  }
}
