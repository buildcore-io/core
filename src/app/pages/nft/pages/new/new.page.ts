import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { FileApi } from '@api/file.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { enumToArray } from '@core/utils/manipulations.utils';
import { Units } from '@core/utils/units-helper';
import { URL_REGEXP } from 'functions/interfaces/config';
import { NzDatePickerComponent } from 'ng-zorro-antd/date-picker';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzUploadChangeParam, NzUploadFile, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { Observable, of, Subscription } from 'rxjs';

export const PRICE_UNITS: Units[] = ['Mi', 'Gi'];
export enum NFTType {
  SINGLE = 0,
  MULTIPLE = 1
}
const MAX_PROPERTIES_COUNT = 5;
const MAX_STATS_COUNT = 5;

@Component({
  selector: 'wen-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewPage {
  @ViewChild('endDatePicker') public endDatePicker!: NzDatePickerComponent;

  public nameControl: FormControl = new FormControl('', Validators.required);
  public descriptionControl: FormControl = new FormControl('', Validators.required);
  public linkControl: FormControl = new FormControl('', Validators.pattern(URL_REGEXP));
  public priceControl: FormControl = new FormControl('', Validators.required);
  public unitControl: FormControl = new FormControl(PRICE_UNITS[0], Validators.required);
  public startControl: FormControl = new FormControl('', Validators.required);
  public endControl: FormControl = new FormControl('', Validators.required);
  public mediaControl: FormControl = new FormControl('');
  public collectionControl: FormControl = new FormControl('');
  public typeControl: FormControl = new FormControl(NFTType.SINGLE, Validators.required);
  public properties: FormArray;
  public stats: FormArray;
  public nftForm: FormGroup;
  public nftTypes = enumToArray(NFTType);
  
  constructor(
    public deviceService: DeviceService,
    private nzNotification: NzNotificationService,
    private auth: AuthService,
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
      link: this.linkControl,
      price: this.priceControl,
      unit: this.unitControl,
      start: this.startControl,
      end: this.endControl,
      media: this.mediaControl,
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

  public uploadFile(item: NzUploadXHRArgs): Subscription {
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

  public uploadChange(event: NzUploadChangeParam): void {
    if (event.type === 'success') {
      this.mediaControl.setValue(event.file.response);
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
      property: new FormControl('', Validators.required),
      item: new FormControl('', Validators.required)
    });
  }

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
      name: new FormControl('', Validators.required),
      value: new FormControl('', [Validators.required, Validators.min(0)])
    });
  }

  public addStat(): void {
    if (this.stats.controls.length < MAX_STATS_COUNT){
      this.stats.push(this.getStatForm());
    }
  }

  public removeStat(index: number): void {
    this.stats.removeAt(index);
  }

  public gForm(f: any, value: string): any {
    return f.get(value);
  }

  public async create(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }
    // Needs to be implemented
    // await this.auth.sign(this.formatSubmitData({...this.collectionForm.value}), (sc, finish) => {
    //   this.notification.processRequest(this.collectionApi.create(sc), 'Created.', finish).subscribe((val: any) => {
    //     this.router.navigate([ROUTER_UTILS.config.collection.root, val?.uid]);
    //   });
    // });
  }

  public disabledStartDate(startValue: Date): boolean {
    // Disable past dates & today + 1day startValue
    if (startValue.getTime() < (Date.now() - (60 * 60 * 1000 * 24))) {
      return true;
    }

    if (!startValue || !this.endControl.value) {
      return false;
    }

    return startValue.getTime() > this.endControl.value.getTime();
  };

  public disabledEndDate(endValue: Date): boolean {
    if (endValue.getTime() < (Date.now() - (60 * 60 * 1000 * 24))) {
      return true;
    }

    if (!endValue || !this.startControl.value) {
      return false;
    }
    return endValue.getTime() <= this.startControl.value.getTime();
  };

  public handleStartOpenChange(open: boolean): void {
    if (!open) {
      this.endDatePicker.open();
    }
  }

  public trackByValue(index: number, item: any): number {
    return item.value;
  }
}
