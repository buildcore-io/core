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
  selector: 'wen-nft-sale-fixed-price',
  templateUrl: './nft-sale-fixed-price.component.html',
  styleUrls: ['./nft-sale-fixed-price.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftSaleFixedPriceComponent implements OnInit {
  public form: FormGroup;
  public priceControl: FormControl = new FormControl('', [Validators.required, Validators.min(0), Validators.max(1000)]);
  public unitControl: FormControl = new FormControl(PRICE_UNITS[0], Validators.required);
  public availableFromControl: FormControl = new FormControl('', Validators.required);
  public selectedAccessControl: FormControl = new FormControl(NftSaleAccess.OPEN, Validators.required);
  public buyerControl: FormControl = new FormControl('');
  public minimumPrice = MIN_IOTA_AMOUNT;
  public maximumPrice = MAX_IOTA_AMOUNT;
  
  constructor() {
    this.form = new FormGroup({
      price: this.priceControl,
      unit: this.unitControl,
      availableFrom: this.availableFromControl,
      selectedAccess: this.selectedAccessControl,
      buyer: this.buyerControl
    });
  }

  ngOnInit(): void {
    merge(this.unitControl.valueChanges, this.priceControl.valueChanges)
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        const value = this.getRawPrice(Number(this.priceControl.value), <Units>this.unitControl.value);
        const errors = value >= MIN_IOTA_AMOUNT && value <= MAX_IOTA_AMOUNT ? null : { price: { valid: false } };
        this.priceControl.setErrors(errors);
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

  private getRawPrice(price: number, unit: Units): number {
    return price * (unit === 'Gi' ? 1000 * 1000 * 1000 : 1000 * 1000);
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
}
