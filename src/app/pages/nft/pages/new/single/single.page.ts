import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FileApi } from '@api/file.api';
import { NftApi } from '@api/nft.api';
import { AuthService } from '@components/auth/services/auth.service';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { NotificationService } from '@core/services/notification';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Units } from '@core/utils/units-helper';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Collection } from 'functions/interfaces/models';
import { MAX_PROPERTIES_COUNT, MAX_STATS_COUNT } from 'functions/interfaces/models/nft';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzUploadChangeParam, NzUploadFile, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { Observable, of, Subscription } from 'rxjs';
import { PRICE_UNITS } from '../new.page';

interface SelectOption {
  label: string;
  value: string;
}

@UntilDestroy()
@Component({
  selector: 'wen-single',
  templateUrl: './single.page.html',
  styleUrls: ['./single.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SinglePage implements OnInit {
  public nameControl: FormControl = new FormControl('', Validators.required);
  public descriptionControl: FormControl = new FormControl('', Validators.required);
  public priceControl: FormControl = new FormControl('', [Validators.required, Validators.min(0), Validators.max(1000)]);
  public unitControl: FormControl = new FormControl(PRICE_UNITS[0], Validators.required);
  public availableFromControl: FormControl = new FormControl('', Validators.required);
  public imageControl: FormControl = new FormControl('');
  public collectionControl: FormControl = new FormControl('');
  public properties: FormArray;
  public stats: FormArray;
  public nftForm: FormGroup;

  constructor(
    public deviceService: DeviceService,
    public cache: CacheService,
    private nzNotification: NzNotificationService,
    private notification: NotificationService,
    private nftApi: NftApi,
    private route: ActivatedRoute,
    private auth: AuthService,
    private router: Router,
    private fileApi: FileApi
  ) {
    this.properties = new FormArray([
      this.getPropertyForm()
    ]);

    this.stats = new FormArray([
      this.getStatForm()
    ]);

    this.nftForm = new FormGroup({
      name: this.nameControl,
      description: this.descriptionControl,
      price: this.priceControl,
      unit: this.unitControl,
      availableFrom: this.availableFromControl,
      image: this.imageControl,
      collection: this.collectionControl,
      properties: this.properties,
      stats: this.stats
    });
  }

  public get priceUnits(): Units[] {
    return PRICE_UNITS;
  }

  public get maxPropertyCount(): number {
    return MAX_PROPERTIES_COUNT;
  }

  public get maxStatCount(): number {
    return MAX_STATS_COUNT;
  }

  public ngOnInit(): void {
    this.route.parent?.params.pipe(untilDestroyed(this)).subscribe((p) => {
      if (p.collection) {
        this.collectionControl.setValue(p.collection);
      }
    });

  }

  public uploadMediaFile(item: NzUploadXHRArgs): Subscription {
    if (!this.auth.member$.value) {
      const err = 'Member seems to log out during the file upload request.';
      this.nzNotification.error(err, '');
      if (item.onError) {
        item.onError(err, item.file);
      }

      return of().subscribe();
    }
    return this.fileApi.upload(this.auth.member$.value.uid, item, 'nft_media');
  }

  public uploadMediaChange(event: NzUploadChangeParam): void {
    if (event.type === 'success') {
      this.imageControl.setValue(event.file.response);
    }
  }

  public previewFile(file: NzUploadFile): Observable<string> {
    return of(file.response);
  };

  private validateForm(): boolean {
    this.nftForm.updateValueAndValidity();
    if (!this.nftForm.valid) {
      Object.values(this.nftForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      return false;
    }

    return true;
  }

  private getPropertyForm(): FormGroup {
    return new FormGroup({
      name: new FormControl(''),
      value: new FormControl('')
    });
  }

  public disabledStartDate(startValue: Date): boolean {
    // Disable past dates & today + 1day startValue
    if (startValue.getTime() < Date.now()) {
      return true;
    }

    return false;
  };

  public addProperty(): void {
    if (this.properties.controls.length < MAX_PROPERTIES_COUNT){
      this.properties.push(this.getPropertyForm());
    }
  }

  public removeProperty(index: number): void {
    this.properties.removeAt(index);
  }

  public getStatForm(): FormGroup {
    return new FormGroup({
      name: new FormControl(''),
      value: new FormControl('')
    });
  }

  public addStat(): void {
    if (this.stats.controls.length < MAX_STATS_COUNT){
      this.stats.push(this.getStatForm());
    }
  }

  public getCollectionListOptions(list?: Collection[] | null): SelectOption[] {
    return (list || []).filter((o) => {
      return o.rejected !== true;
    }).map((o) => ({
        label: o.name || o.uid,
        value: o.uid
    }));
  }

  public removeStat(index: number): void {
    this.stats.removeAt(index);
  }

  public gForm(f: any, value: string): any {
    return f.get(value);
  }

  public formatSubmitData(data: any): any {
    if (<Units>data.unit === 'Gi') {
      data.price = data.price * 1000 * 1000 * 1000;
    } else {
      data.price = data.price * 1000 * 1000;
    }

    const stats: any = {};
    data.stats.forEach((v: any) => {
      if (v.name) {
        const formattedKey: string = v.name.replace(/\s/g, '').toLowerCase();
        stats[formattedKey] = {
          label: v.name,
          value: v.value
        };
      }
    });
    data.stats = stats;

    const properties: any = {};
    data.properties.forEach((v: any) => {
      if (v.name) {
        const formattedKey: string = v.name.replace(/\s/g, '').toLowerCase();
        properties[formattedKey] = {
          label: v.name,
          value: v.value
        };
      }
    });
    data.properties = properties;

    delete data.unit;
    return data;
  }

  public async create(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    await this.auth.sign(this.formatSubmitData({...this.nftForm.value}), (sc, finish) => {
      this.notification.processRequest(this.nftApi.create(sc), 'Created.', finish).subscribe((val: any) => {
        this.router.navigate([ROUTER_UTILS.config.nft.root, val?.uid]);
      });
    });
  }

  public trackByValue(index: number, item: any): number {
    return item.value;
  }
}
