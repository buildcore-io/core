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

@Component({
  selector: 'wen-trading-view',
  templateUrl: './trading-view.component.html',
  styleUrls: ['./trading-view.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradingViewComponent implements OnInit, AfterViewInit {
  @Input()
  public set data(value: TokenPurchase[]) {
    this._data = value;
    this.drawData();
  }
  public get data(): TokenPurchase[] {
    return this._data;
  }
  public selectedInterval = '';
  public intervals: any[] = [
    { label: '1h', value: '1h' },
    { label: '4h', value: '4h' },
    { label: '8h', value: '8h' },
    { label: '1d', value: '1d' },
  ];

  @ViewChild('tradingView') tradingViewEleRef?: ElementRef<HTMLElement>;
  private candlestickSeries?: ISeriesApi<'Candlestick'>;
  private _data: TokenPurchase[] = [];
  private timeLimit = 3600;

  public ngOnInit(): void {
    this.drawData();
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

  private storeSelection(): void {
    localStorage.setItem('defaultInterval', this.selectedInterval);
  }

  private setTimeLimit(): void {
    const time = parseInt(this.selectedInterval.split('')[0], 10);
    const unit = this.selectedInterval.split('')[1];

    switch (unit) {
    case 'h':
      this.timeLimit = 3600 * time;
      break;
    case 'd':
      this.timeLimit = 3600 * 24 * time;
      break;
    }
  }

  public clickInterval(interval: any): void {
    this.selectedInterval = interval.value;
    this.setTimeLimit();
    this.drawData();
  }
}
