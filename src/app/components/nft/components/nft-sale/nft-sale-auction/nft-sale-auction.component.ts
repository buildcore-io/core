import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Units, UnitsHelper } from '@core/utils/units-helper';
import { environment } from '@env/environment';
import { MAX_IOTA_AMOUNT, MIN_IOTA_AMOUNT } from '@functions/interfaces/config';
import { TRANSACTION_AUTO_EXPIRY_MS } from '@functions/interfaces/models';
import { Nft, NftAccess, PRICE_UNITS } from '@functions/interfaces/models/nft';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import dayjs from 'dayjs';
import { merge } from 'rxjs';
import { SaleType, UpdateEvent } from '../nft-sale.component';

@UntilDestroy()
@Component({
  selector: 'wen-nft-sale-auction',
  templateUrl: './nft-sale-auction.component.html',
  styleUrls: ['./nft-sale-auction.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftSaleAuctionComponent implements OnInit {
  @Input()
  set nft(value: Nft|null|undefined) {
    this._nft = value;
    if (this._nft) {
      this.availableFromControl.setValue(this._nft.auctionFrom || '');
      this.selectedAccessControl.setValue(this._nft.saleAccess || NftAccess.OPEN);
      this.buyerControl.setValue(this._nft.saleAccessMembers || []);
      if (this._nft.availablePrice) {
        this.buyAvailableControl.setValue(true);
        if (this._nft.availablePrice >= 1000 * 1000 * 1000) {
          this.buyPriceControl.setValue(this._nft.availablePrice / 1000 / 1000 / 1000);
          this.buyUnitControl.setValue(<Units>'Gi');
        } else {
          this.buyPriceControl.setValue(this._nft.availablePrice / 1000 / 1000);
          this.buyUnitControl.setValue(<Units>'Mi');
        }
      }

      if (this._nft.auctionFloorPrice) {
        if (this._nft.auctionFloorPrice >= 1000 * 1000 * 1000) {
          this.floorPriceControl.setValue(this._nft.auctionFloorPrice / 1000 / 1000 / 1000);
          this.floorUnitControl.setValue(<Units>'Gi');
        } else {
          this.floorPriceControl.setValue(this._nft.auctionFloorPrice / 1000 / 1000);
          this.floorUnitControl.setValue(<Units>'Mi');
        }
      }

      if (this.nft?.auctionFrom && dayjs(this.nft.auctionFrom.toDate()).isAfter(dayjs())) {
        this.floorPriceControl.disable();
        this.floorUnitControl.disable();
        this.availableFromControl.disable();
        this.selectedAccessControl.disable();
        this.buyerControl.disable();
      }
    }
  }
  get nft(): Nft|null|undefined {
    return this._nft;
  }
  @Output() public wenOnUpdate = new EventEmitter<UpdateEvent>();
  public form: FormGroup;
  public floorPriceControl: FormControl = new FormControl('', [Validators.required, Validators.min(0), Validators.max(1000)]);
  public floorUnitControl: FormControl = new FormControl(PRICE_UNITS[0], Validators.required);
  public buyPriceControl: FormControl = new FormControl('');
  public buyUnitControl: FormControl = new FormControl(PRICE_UNITS[0], Validators.required);
  public availableFromControl: FormControl = new FormControl('', Validators.required);
  public selectedAccessControl: FormControl = new FormControl(NftAccess.OPEN, Validators.required);
  public buyerControl: FormControl = new FormControl('');
  public buyAvailableControl: FormControl = new FormControl(false);
  public minimumPrice = MIN_IOTA_AMOUNT;
  public maximumPrice = MAX_IOTA_AMOUNT;
  private _nft?: Nft|null;

  constructor() {
    this.form = new FormGroup({
      floorPrice: this.floorPriceControl,
      floorUnit: this.floorUnitControl,
      availableFrom: this.availableFromControl,
      selectedAccess: this.selectedAccessControl,
      buyer: this.buyerControl,
      buyPrice: this.buyPriceControl,
      buyUnit: this.buyUnitControl
    });}

  ngOnInit(): void {
    merge(this.floorPriceControl.valueChanges, this.floorUnitControl.valueChanges)
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        const value = this.getRawPrice(Number(this.floorPriceControl.value), <Units>this.floorUnitControl.value);
        const errors = value >= MIN_IOTA_AMOUNT && value <= MAX_IOTA_AMOUNT ? null : { price: { valid: false } };
        this.floorPriceControl.setErrors(errors);
      });

    merge(this.buyPriceControl.valueChanges, this.buyUnitControl.valueChanges, this.buyAvailableControl.valueChanges)
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        if (!this.buyAvailableControl.value) {
          this.buyPriceControl.setErrors(null);
          return;
        }
        const value = this.getRawPrice(Number(this.buyPriceControl.value), <Units>this.buyUnitControl.value);
        const errors = value >= MIN_IOTA_AMOUNT && value <= MAX_IOTA_AMOUNT ? null : { price: { valid: false } };
        this.buyPriceControl.setErrors(errors);
      });

    this.selectedAccessControl.valueChanges.pipe(untilDestroyed(this))
      .subscribe(() => {
        switch (this.selectedAccessControl.value) {
          case NftAccess.OPEN:
            this.buyerControl.removeValidators(Validators.required);
            this.buyerControl.setErrors(null);
            break;
          case NftAccess.MEMBERS:
            this.buyerControl.addValidators(Validators.required);
            break;
        }
      });
  }

  public formatBest(amount: number|undefined): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
  }

  public get priceUnits(): Units[] {
    return PRICE_UNITS;
  }

  public disabledStartDate(startValue: Date): boolean {
    if (dayjs(startValue).isBefore(dayjs(), 'days')) {
      return true;
    }

    return false;
  }

  public get targetAccess(): typeof NftAccess {
    return NftAccess;
  }

  private getRawPrice(price: number, unit: Units): number {
    return price * (unit === 'Gi' ? 1000 * 1000 * 1000 : 1000 * 1000);
  }

  public isProd(): boolean {
    return environment.production;
  }

  public submit(): void {
    const up: UpdateEvent = {
      type: SaleType.FIXED_PRICE,
      auctionFrom: this.availableFromControl.value,
      // TODO Implement switch
      auctionLength: TRANSACTION_AUTO_EXPIRY_MS,
      auctionFloorPrice: this.getRawPrice(this.floorPriceControl.value, this.floorUnitControl.value),
      access: this.selectedAccessControl.value,
      accessMembers: this.buyerControl.value
    };

    if (this.buyAvailableControl.value) {
      up.availableFrom = this.availableFromControl.value;
      up.price = this.getRawPrice(this.buyPriceControl.value, this.buyUnitControl.value);
    }

    this.wenOnUpdate.next(up);
  }
}
