import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { FileApi } from '@api/file.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { Units, UnitsHelper } from '@core/utils/units-helper';
import { MAX_IOTA_AMOUNT, MIN_AMOUNT_TO_TRANSFER, MIN_IOTA_AMOUNT, NftAvailableFromDateMin } from '@functions/interfaces/config';
import { Collection, CollectionType } from '@functions/interfaces/models';
import { Nft, PRICE_UNITS } from '@functions/interfaces/models/nft';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import dayjs from 'dayjs';
import { merge, take } from 'rxjs';

export enum SaleType {
  NOT_FOR_SALE = 'NOT_FOR_SALE',
  FIXED_PRICE = 'FIXED_PRICE',
  AUCTION = 'AUCTION'
}

export enum NftSaleAccess {
  OPEN = 0,
  MEMBERS_ONLY = 1,
  SPECIFIC_ONLY = 2
}

@UntilDestroy()
@Component({
  selector: 'wen-nft-sale',
  templateUrl: './nft-sale.component.html',
  styleUrls: ['./nft-sale.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftSaleComponent implements OnInit {
  @Input() currentSaleType = SaleType.NOT_FOR_SALE;
  @Input() isOpen = false;
  @Input() collection?: Collection|null;
  @Input()
  set nft(value: Nft|null|undefined) {
    this._nft = value;
    if (this._nft) {
      this.fileApi.getMetadata(this._nft.media).pipe(take(1), untilDestroyed(this)).subscribe((o) => {
        if (o.contentType.match('video/.*')) {
          this.mediaType = 'video';
        } else if (o.contentType.match('image/.*')) {
          this.mediaType = 'image';
        }

        this.cd.markForCheck();
      });
    }
  }
  get nft(): Nft|null|undefined {
    return this._nft;
  }
  @Output() wenOnClose = new EventEmitter<void>();
  public saleType = SaleType;
  public mediaType: 'video'|'image'|undefined;
  public fixedPriceForm: FormGroup;
  public auctionForm: FormGroup;
  public fixedPriceControl: FormControl = new FormControl('', [Validators.required, Validators.min(0), Validators.max(1000)]);
  public fixedUnitControl: FormControl = new FormControl(PRICE_UNITS[0], Validators.required);
  public fixedAvailableFromControl: FormControl = new FormControl('', Validators.required);
  public fixedSelectedAccessControl: FormControl = new FormControl(NftSaleAccess.OPEN, Validators.required);
  public fixedBuyerControl: FormControl = new FormControl('');
  public auctionFloorPriceControl: FormControl = new FormControl('', [Validators.required, Validators.min(0), Validators.max(1000)]);
  public auctionFloorUnitControl: FormControl = new FormControl(PRICE_UNITS[0], Validators.required);
  public auctionBuyPriceControl: FormControl = new FormControl('', [Validators.required, Validators.min(0), Validators.max(1000)]);
  public auctionBuyUnitControl: FormControl = new FormControl(PRICE_UNITS[0], Validators.required);
  public auctionAvailableFromControl: FormControl = new FormControl('', Validators.required);
  public auctionSelectedAccessControl: FormControl = new FormControl(NftSaleAccess.OPEN, Validators.required);
  public auctionBuyerControl: FormControl = new FormControl('');
  public auctionBuyAvailableControl: FormControl = new FormControl(false);
  public minimumPrice = MIN_IOTA_AMOUNT;
  public maximumPrice = MAX_IOTA_AMOUNT;
  private _nft?: Nft|null;

  constructor(
    public deviceService: DeviceService,
    private cd: ChangeDetectorRef,
    private fileApi: FileApi,
    private auth: AuthService
  ) {
    this.fixedPriceForm = new FormGroup({
      price: this.fixedPriceControl,
      unit: this.fixedUnitControl,
      availableFrom: this.fixedAvailableFromControl,
      selectedAccess: this.fixedSelectedAccessControl,
      buyer: this.fixedBuyerControl
    });
    
    this.auctionForm = new FormGroup({
      floorPrice: this.auctionFloorPriceControl,
      floorUnit: this.auctionFloorUnitControl,
      availableFrom: this.auctionAvailableFromControl,
      selectedAccess: this.auctionSelectedAccessControl,
      buyer: this.auctionBuyerControl,
      buyPrice: this.auctionBuyPriceControl,
      buyUnit: this.auctionBuyUnitControl
    });
  }

  public ngOnInit(): void {
    merge(this.fixedUnitControl.valueChanges, this.fixedPriceControl.valueChanges)
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        const value = this.getRawPrice(Number(this.fixedPriceControl.value), <Units>this.fixedUnitControl.value);
        const errors = value >= MIN_IOTA_AMOUNT && value <= MAX_IOTA_AMOUNT ? null : { price: { valid: false } };
        this.fixedPriceControl.setErrors(errors);
      });
      
    this.fixedSelectedAccessControl.valueChanges.pipe(untilDestroyed(this))
      .subscribe(() => {
        switch (this.fixedSelectedAccessControl.value) {
          case NftSaleAccess.OPEN:
          case NftSaleAccess.MEMBERS_ONLY:
            this.fixedBuyerControl.removeValidators(Validators.required);
            this.fixedBuyerControl.setErrors(null);
            break;
          case NftSaleAccess.SPECIFIC_ONLY:
            this.fixedBuyerControl.addValidators(Validators.required);
            break;
        }
      });

    merge(this.auctionFloorPriceControl.valueChanges, this.auctionFloorUnitControl.valueChanges)
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        const value = this.getRawPrice(Number(this.auctionFloorPriceControl.value), <Units>this.auctionFloorUnitControl.value);
        const errors = value >= MIN_IOTA_AMOUNT && value <= MAX_IOTA_AMOUNT ? null : { price: { valid: false } };
        this.auctionFloorPriceControl.setErrors(errors);
      });

    merge(this.auctionBuyPriceControl.valueChanges, this.auctionBuyUnitControl.valueChanges, this.auctionBuyAvailableControl.valueChanges)
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        if (!this.auctionBuyAvailableControl.value) {
          this.auctionBuyPriceControl.setErrors(null);
          return;
        }
        const value = this.getRawPrice(Number(this.auctionBuyPriceControl.value), <Units>this.auctionBuyUnitControl.value);
        const errors = value >= MIN_IOTA_AMOUNT && value <= MAX_IOTA_AMOUNT ? null : { price: { valid: false } };
        this.auctionBuyPriceControl.setErrors(errors);
      });
      
    this.auctionSelectedAccessControl.valueChanges.pipe(untilDestroyed(this))
      .subscribe(() => {
        switch (this.auctionSelectedAccessControl.value) {
          case NftSaleAccess.OPEN:
          case NftSaleAccess.MEMBERS_ONLY:
            this.auctionBuyerControl.removeValidators(Validators.required);
            this.auctionBuyerControl.setErrors(null);
            break;
          case NftSaleAccess.SPECIFIC_ONLY:
            this.auctionBuyerControl.addValidators(Validators.required);
            break;
        }
      });
  }

  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }

  public reset(): void {
    this.isOpen = false;
    this.currentSaleType = SaleType.NOT_FOR_SALE;
    this.cd.markForCheck();
  }

  public getTitle(): any {
    if (!this.nft) {
      return '';
    }
    if (this.nft.type === CollectionType.CLASSIC) {
      return this.nft.name;
    } else if (this.nft.type === CollectionType.GENERATED) {
      return $localize`Generated NFT`;
    } else if (this.nft.type === CollectionType.SFT) {
      return $localize`SFT`;
    }
  }

  public discount(): number {
    if (!this.collection?.space || !this.auth.member$.value?.spaces?.[this.collection.space]?.totalReputation) {
      return 1;
    }

    const xp: number = this.auth.member$.value.spaces[this.collection.space].totalReputation || 0;
    let discount = 1;
    if (xp > 0) {
      for (const d of this.collection.discounts) {
        if (d.xp < xp) {
          discount = (1 - d.amount);
        }
      }
    }

    return discount;
  }

  public calc(amount: number, discount: number): number {
    let finalPrice = Math.ceil(amount * discount);
    if (finalPrice < MIN_AMOUNT_TO_TRANSFER) {
      finalPrice = MIN_AMOUNT_TO_TRANSFER;
    }

    finalPrice = Math.floor((finalPrice / 1000 / 10)) * 1000 * 10; // Max two decimals on Mi.
    return finalPrice;
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
