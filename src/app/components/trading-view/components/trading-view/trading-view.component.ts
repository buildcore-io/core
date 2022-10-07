import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input, OnInit,
  ViewChild
} from '@angular/core';
import { TokenPurchase } from '@functions/interfaces/models';
import {
  CandlestickData, createChart, CrosshairMode, ISeriesApi, UTCTimestamp
} from 'lightweight-charts';

export enum TRADING_VIEW_INTERVALS {
  '1h' = '1h',
  '4h' = '4h',
  '1d' = '1d'
}

@Component({
  selector: 'wen-trading-view',
  templateUrl: './trading-view.component.html',
  styleUrls: ['./trading-view.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradingViewComponent implements OnInit, AfterViewInit {
  @Input()
  public set interval(value: TRADING_VIEW_INTERVALS) {
    this._interval = value;
    this.drawData();
  }
  public get data(): TokenPurchase[] {
    return this._data;
  }

  @ViewChild('tradingView') tradingViewEleRef?: ElementRef<HTMLElement>;
  private candlestickSeries?: ISeriesApi<'Candlestick'>;
  private _data: TokenPurchase[] = [];
  private _interval: TRADING_VIEW_INTERVALS = TRADING_VIEW_INTERVALS['1h'];
  private timeLimit = 3600;

  public ngOnInit(): void {
    this.drawData();
    /*

    this.subscriptions$.push(this.tokenPurchaseApi.listenToPurchases24h(tokenId, status).pipe(untilDestroyed(this)).subscribe(this.listenToPurchases24h$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenToPurchases7d(tokenId, status).pipe(untilDestroyed(this)).subscribe(this.listenToPurchases7d$));

    */
  }

  public ngAfterViewInit(): void {
    if (this.tradingViewEleRef) {
      const chart = createChart(this.tradingViewEleRef.nativeElement, {
        width: 1000,
        height: 400,
        crosshair: {
          mode: CrosshairMode.Normal,
        },
      });
      this.candlestickSeries = chart.addCandlestickSeries();
      chart.timeScale().fitContent();
    }
  }

  private drawData(): void {
    const chartData: CandlestickData[] = [];
    this.setTimeLimit();
    this.data.sort((a, b) => {
      return a.createdOn!.seconds - b.createdOn!.seconds;
    }).forEach((t) => {
      chartData.push({
        time: t.createdOn!.seconds as UTCTimestamp,
        open: (t.price) || 0,
        high: (t.price) || 0,
        low: (t.price) || 0,
        close: (t.price) || 0
      })
    });
    // const data = {
    //   time: (res.E / 1000) as UTCTimestamp,
    //   open: parseFloat(res.k.o),
    //   close: parseFloat(res.k.c),
    //   high: parseFloat(res.k.h),
    //   low: parseFloat(res.k.l),
    // };
    // const t1 = data.time as number
    // const t2 = this.kData[this.kData.length - 1].time as number;
    // if (t1 - t2 < this.timeLimit) {
    //   this.kData[this.kData.length - 1] = data;
    // }
    // if (t1 - t2 === this.timeLimit) {
    //   this.kData.push(data);
    // }
    if (this.candlestickSeries && chartData.length > 0) {
      setInterval(()=> {
        console.log(chartData);
        this.candlestickSeries!.setData(chartData);
      }, 2000);
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
    }
  }
}
