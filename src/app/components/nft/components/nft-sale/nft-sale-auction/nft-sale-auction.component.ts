import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Units, UnitsHelper } from '@core/utils/units-helper';
import { MAX_IOTA_AMOUNT, MIN_IOTA_AMOUNT, NftAvailableFromDateMin } from '@functions/interfaces/config';
import { PRICE_UNITS } from '@functions/interfaces/models/nft';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import dayjs from 'dayjs';
import { merge } from 'rxjs';
import { NftSaleAccess } from '../nft-sale.component';

@UntilDestroy()
@Component({
  selector: 'wen-nft-sale-auction',
  templateUrl: './nft-sale-auction.component.html',
  styleUrls: ['./nft-sale-auction.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftSaleAuctionComponent implements OnInit {
  public form: FormGroup;
  public floorPriceControl: FormControl = new FormControl('', [Validators.required, Validators.min(0), Validators.max(1000)]);
  public floorUnitControl: FormControl = new FormControl(PRICE_UNITS[0], Validators.required);
  public buyPriceControl: FormControl = new FormControl('', [Validators.required, Validators.min(0), Validators.max(1000)]);
  public buyUnitControl: FormControl = new FormControl(PRICE_UNITS[0], Validators.required);
  public availableFromControl: FormControl = new FormControl('', Validators.required);
  public selectedAccessControl: FormControl = new FormControl(NftSaleAccess.OPEN, Validators.required);
  public buyerControl: FormControl = new FormControl('');
  public buyAvailableControl: FormControl = new FormControl(false);
  public minimumPrice = MIN_IOTA_AMOUNT;
  public maximumPrice = MAX_IOTA_AMOUNT;

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
          case NftSaleAccess.OPEN:
          case NftSaleAccess.MEMBERS_ONLY:
            this.buyerControl.removeValidators(Validators.required);
            this.buyerControl.setErrors(null);
            break;
          case NftSaleAccess.SPECIFIC_ONLY:
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
    // Disable past dates & today + 1day startValue
    if (startValue.getTime() < dayjs().add(NftAvailableFromDateMin.value, 'ms').toDate().getTime()) {
      return true;
    }

    return false;
  }

  public get targetAccess(): typeof NftSaleAccess {
    return NftSaleAccess;
  }

  private getRawPrice(price: number, unit: Units): number {
    return price * (unit === 'Gi' ? 1000 * 1000 * 1000 : 1000 * 1000);
  }
}
