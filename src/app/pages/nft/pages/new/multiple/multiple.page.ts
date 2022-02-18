import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { FileApi } from '@api/file.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { download } from '@core/utils/tools.utils';
import { MAX_IOTA_AMOUNT, MIN_IOTA_AMOUNT } from 'functions/interfaces/config';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzUploadChangeParam, NzUploadFile, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import Papa from 'papaparse';
import { Observable, of, Subscription } from 'rxjs';
import { StepType } from '../new.page';

export interface NFTObject {
  [key: string]: {
    label: string;
    subName?: string;
    validate: (value: any) => boolean;
    isArray?: boolean;
    defaultAmount?: number;
  }
}

@Component({
  selector: 'wen-multiple',
  templateUrl: './multiple.page.html',
  styleUrls: ['./multiple.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultiplePage {
  public collectionControl: FormControl = new FormControl('');
  public nftForm: FormGroup;
  public stepType = StepType;
  public currentStep = StepType.GENERATE;
  public previewFile?: NzUploadFile | null;
  public uploadedFiles: NzUploadFile[] = [];
  public nftObject:  NFTObject = {
    media: {
      label: 'media',
      validate: (value: string) => !!value
    },
    name: {
      label: 'name',
      validate: (value: string) => !!value
    },
    description: {
      label: 'description',
      validate: (value: string) => !!value
    },
    price: {
      label: 'price',
      validate: (value: string) => !!value && Number(value) > MIN_IOTA_AMOUNT && Number(value) < MAX_IOTA_AMOUNT
    },
    // TODO only consider when CLASSIC.
    availableFrom: {
      label: 'availableFrom',
      validate: (value: string) => !!value && !isNaN(Date.parse(value))
    },
    propertyLabel: {
      label: 'prop',
      subName: 'label',
      validate: () => true,
      isArray: true,
      defaultAmount: 10
    },
    propertyValue: {
      label: 'prop',
      subName: 'value',
      validate: () => true,
      isArray: true,
      defaultAmount: 10
    },
    statLabel: {
      label: 'stat',
      subName: 'label',
      validate: () => true,
      isArray: true,
      defaultAmount: 10
    },
    statValue: {
      label: 'stat',
      subName: 'value',
      validate: () => true,
      isArray: true,
      defaultAmount: 10
    },
  }

  constructor(
    public deviceService: DeviceService,
    private nzNotification: NzNotificationService,
    private auth: AuthService,
    private fileApi: FileApi
  ) {
    this.nftForm = new FormGroup({
      collection: this.collectionControl
    });
  }

  public uploadMultipleFiles(item: NzUploadXHRArgs): Subscription {
    if (!this.auth.member$.value) {
      const err = 'Member seems to log out during the file upload request.';
      this.nzNotification.error(err, '');
      if (item.onError) {
        item.onError(err, item.file);
      }

      return of().subscribe();
    }
    this.currentStep = StepType.GENERATE;
    return this.fileApi.upload(this.auth.member$.value.uid, item, 'nft_media');
  }

  public uploadMultipleChange(event: NzUploadChangeParam): void {
    if (event.type === 'success') {
      this.uploadedFiles.push(event.file);
    }
  }

  public onPreview(file: NzUploadFile): void {
    this.previewFile = file;
  }

  public beforeCSVUpload(file: NzUploadFile) : boolean | Observable<boolean> {
    if (!file) return false;

    Papa.parse(file as unknown as File, {
      complete: (results: any) => {
        // Use this nfts for multiple upload
        const nfts =
          results.data
            .slice(1)
            .map((row: string[]) =>
              row.reduce((acc: any, cur: string, index: number) => ({ ...acc, [results.data[0][index]]: cur }), {}))
            .filter((nft: any) =>
              Object.values(this.nftObject)
                .every((field) => field.isArray ?
                  Object.keys(nft)
                    .filter((key: string) => key.startsWith(field.label))
                    .every((key: string) => field.validate(nft[key])) : field.validate(nft[field.label])))
            .map((nft: any) =>
              Object.keys(nft)
                .reduce((acc: any, key: string) => {
                  const fieldKey =  Object.keys(this.nftObject).find((k) => key.startsWith(this.nftObject[k].label)) || '';
                  return this.nftObject[fieldKey]?.isArray ?
                    { ...acc, [fieldKey]: [...(acc[fieldKey] || []), { [key]: nft[key] }] } :
                    { ...acc, [fieldKey]: nft[key] };
                }, {}));

        // Result.
        console.log(nfts);
      }
    })
    return false;
  }

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

  public buttonClick(): void {
    if (this.currentStep === StepType.GENERATE) {
      this.generate();
    } else {
      this.publish();
    }
  }

  public generate(): void {
    const fields =
      ['', ...Object.values(this.nftObject)
        .map(item => item.isArray ? [...Array(5).keys()].map((num: number) => `${item.label}.${item.subName}${num+1}`) : [item.label])
        .reduce((acc: string[], cur: string[]) => [...acc, ...cur], [] as string[])];

    const data =
      this.uploadedFiles
        .map((file: NzUploadFile) => [file.name, ...new Array(fields.length - 2).fill('')])

    const csv = Papa.unparse({
      fields,
      data
    });

    download(`data:text/csv;charset=utf-8${csv}`, 'WEN-NFT-upload.csv');
    this.currentStep = StepType.PUBLISH;
  }

  public async publish(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }
  }
}
