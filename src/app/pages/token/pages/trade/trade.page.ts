import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { DeviceService } from '@core/services/device';

export enum ChartLengthType {
  DAY = '24h',
  WEEK = '7d',
}

export enum OfferListingType {
  OPEN = 'OPEN',
  MY = 'MY'
}

export enum RequestListingType {
  OPEN = 'OPEN',
  MY = 'MY'
}

@Component({
  selector: 'wen-trade',
  templateUrl: './trade.page.html',
  styleUrls: ['./trade.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradePage {
  public chartLengthOptions = [
    { label: $localize`24h`, value: ChartLengthType.DAY },
    { label: $localize`7d`, value: ChartLengthType.WEEK },
  ];
  public chartLengthControl: FormControl = new FormControl(ChartLengthType.WEEK, Validators.required);
  public currentOfferListing = OfferListingType.OPEN;
  public currentRequestListing = RequestListingType.OPEN;
  public isBidTokenOpen = false;
  public isOfferTokenOpen = true;

  public openOffers = [
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 }
  ];
  public myOffers = [
    { price: '100 Mi', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', status: 'Fullfiled 100%', amount: 32132, total: 31231329 },
    { price: '100 Mi', status: 'Partly Fullfiled, Initial Amount 2222', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', status: 'Fullfiled 100%', amount: 32132, total: 31231329 },
    { price: '100 Mi', status: 'Partly Fullfiled, Initial Amount 2222', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', status: 'Fullfiled 100%', amount: 32132, total: 31231329 },
    { price: '100 Mi', status: 'Partly Fullfiled, Initial Amount 2222', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', status: 'Fullfiled 100%', amount: 32132, total: 31231329 },
    { price: '100 Mi', status: 'Partly Fullfiled, Initial Amount 2222', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', status: 'Fullfiled 100%', amount: 32132, total: 31231329 },
    { price: '100 Mi', status: 'Partly Fullfiled, Initial Amount 2222', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', status: 'Fullfiled 100%', amount: 32132, total: 31231329 },
    { price: '100 Mi', status: 'Partly Fullfiled, Initial Amount 2222', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', status: 'Fullfiled 100%', amount: 32132, total: 31231329 },
    { price: '100 Mi', status: 'Partly Fullfiled, Initial Amount 2222', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', status: 'Fullfiled 100%', amount: 32132, total: 31231329 },
    { price: '100 Mi', status: 'Partly Fullfiled, Initial Amount 2222', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', status: 'Fullfiled 100%', amount: 32132, total: 31231329 },
    { price: '100 Mi', status: 'Partly Fullfiled, Initial Amount 2222', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', status: 'Fullfiled 100%', amount: 32132, total: 31231329 },
    { price: '100 Mi', status: 'Partly Fullfiled, Initial Amount 2222', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', status: 'Fullfiled 100%', amount: 32132, total: 31231329 },
    { price: '100 Mi', status: 'Partly Fullfiled, Initial Amount 2222', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', status: 'Fullfiled 100%', amount: 32132, total: 31231329 },
    { price: '100 Mi', status: 'Partly Fullfiled, Initial Amount 2222', amount: 32132, total: 31231329, canCancel: true },
    { price: '100 Mi', amount: 32132, total: 31231329 },
    { price: '100 Mi', amount: 32132, total: 31231329 }
  ];

  constructor(
    public deviceService: DeviceService
  ) {}

  public get chartLengthTypes(): typeof ChartLengthType {
    return ChartLengthType;
  }

  public get offerListingTypes(): typeof OfferListingType {
    return OfferListingType;
  }
  
  public get requestListingTypes(): typeof RequestListingType {
    return RequestListingType;
  }
}
