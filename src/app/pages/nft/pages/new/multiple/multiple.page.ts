/* eslint-disable no-invalid-this */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FileApi } from '@api/file.api';
import { NftApi } from '@api/nft.api';
import { AuthService } from '@components/auth/services/auth.service';
import { SelectCollectionOption } from '@components/collection/components/select-collection/select-collection.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { NotificationService } from '@core/services/notification';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { download } from '@core/utils/tools.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Collection, CollectionType } from 'functions/interfaces/models';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzUploadChangeParam, NzUploadFile, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import Papa from 'papaparse';
import { merge, Observable, of, Subscription } from 'rxjs';
import { StepType } from '../new.page';

export interface NFTObject {
  [key: string]: {
    label: string;
    subName?: string;
    validate: (value: any) => boolean;
    value?: () => any;
    mapper?: (value: any) => any;
    isArray?: boolean;
    defaultAmount?: number;
  }
}

@UntilDestroy()
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
  public previewNft?: any | null;
  public uploadedFiles: NzUploadFile[] = [];
  public price?: number | null;
  public availableFrom?: Date | null;
  public nfts: any[] = [];
  public nftObject:  NFTObject = {
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
      validate: (value: string) => {
        const price = Number(value);
        if (!value || isNaN(price)) return false;
        if (this.price) {
          return price === this.price;
        }
        return true;
      },
      value: () => this.price || ''
    },
    availableFrom: {
      label: 'available_from',
      validate: (value: string) => {
        if(!value || isNaN(Date.parse(value))) return false;
        const d = new Date(value);
        if (this.availableFrom) {
          return d.getTime() === this.availableFrom.getTime();
        }
        return new Date().getTime() < d.getTime();
      },
      value: () => this.availableFrom || '',
      mapper: (value: string) => new Date(value)
    },
    property: {
      label: 'prop',
      subName: 'label',
      validate: () => true,
      isArray: true,
      defaultAmount: 5
    },
    stat: {
      label: 'stat',
      subName: 'label',
      validate: () => true,
      isArray: true,
      defaultAmount: 5
    },
    media: {
      label: 'media',
      validate: (value: string) => !!value
    }
  };

  constructor(
    public deviceService: DeviceService,
    public cache: CacheService,
    private nzNotification: NzNotificationService,
    private notification: NotificationService,
    private auth: AuthService,
    private fileApi: FileApi,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef,
    private nftApi: NftApi,
    private router: Router
  ) {
    this.nftForm = new FormGroup({
      collection: this.collectionControl
    });
  }

  public ngOnInit(): void {
    merge(this.collectionControl.valueChanges, this.cache.allCollections$)
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        const finObj: Collection|undefined = this.cache.allCollections$.value.find((subO: any) => {
          return subO.uid === this.collectionControl.value;
        });
        if (finObj && (finObj.type === CollectionType.GENERATED || finObj.type === CollectionType.CLASSIC)) {
          this.price = (finObj.price || 0);
          this.availableFrom = (finObj.availableFrom || finObj.createdOn).toDate();
        } else {
          this.price = null;
          this.availableFrom = null;
        }
      });

    this.route.parent?.params.pipe(untilDestroyed(this)).subscribe((p) => {
      if (p.collection) {
        this.collectionControl.setValue(p.collection);
      }
    });
  }

  public getCollectionListOptions(list?: Collection[] | null): SelectCollectionOption[] {
    return (list || [])
      .filter((o) => o.rejected !== true)
      .map((o) => ({
          label: o.name || o.uid,
          value: o.uid
      }));
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
    return this.fileApi.upload(this.auth.member$.value.uid, item, 'nft_media');
  }

  public uploadMultipleChange(event: NzUploadChangeParam): void {
    if (event.type === 'success') {
      this.uploadedFiles.push(event.file);
    }
  }

  public formatSubmitData(data: any): any {
    const stats: any = {};
    if (data.stat) {
      data.stat
        .map((s: { [key: string]: string }) => ({ label: Object.keys(s)[0], value: Object.values(s)[0] }))
        .forEach((v: any) => {
          if (v.label && v.value) {
            const formattedKey: string = v.label.replace(/\s/g, '').toLowerCase();
            stats[formattedKey] = {
              label: v.label,
              value: v.value
            };
          }
        });
      if (Object.keys(stats).length) {
        data.stats = stats;
      }
      delete data.stat;
    }

    if (data.property) {
      const properties: any = {};
      data.property
        .map((p: { [key: string]: string }) => ({ label: Object.keys(p)[0], value: Object.values(p)[0] }))
        .forEach((v: any) => {
          if (v.label && v.value) {
            const formattedKey: string = v.label.replace(/\s/g, '').toLowerCase();
            properties[formattedKey] = {
              label: v.label,
              value: v.value
            };
          }
        });
      if (Object.keys(properties).length) {
        data.properties = properties;
      }
      delete data.property;
    }

    data.price = Number(data.price);
    data.collection = this.collectionControl.value;
    return data;
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
                  const value = this.nftObject[fieldKey]?.mapper?.call(this, nft[key]) || nft[key];
                  return this.nftObject[fieldKey]?.isArray ?
                    { ...acc, [fieldKey]: [...(acc[fieldKey] || []), { [key]: value }] } :
                    { ...acc, [fieldKey]: value };
                }, {}));
        this.currentStep = StepType.PUBLISH;
        console.log(this.nfts);
        this.nfts = nfts.map((nft: any) => this.formatSubmitData(nft));
        console.log(this.nfts);
        this.cd.markForCheck();
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
        .map(item => item.isArray ? [...Array(item.defaultAmount).keys()].map((num: number) => `${item.label}.${item.subName}${num+1}`) : [item.label])
        .reduce((acc: string[], cur: string[]) => [...acc, ...cur], [] as string[])];

    const data =
      this.uploadedFiles
        .map((file: NzUploadFile) => [
          ...fields.slice(1, fields.length-1)
            .map((f: string) => {
              const obj = Object.values(this.nftObject).find((item) => f.startsWith(item.label));
              return obj?.value ? obj?.value() : '';
            }), 
          file.response]);
  
    const csv = Papa.unparse({
      fields,
      data
    });

    download(`data:text/csv;charset=utf-8${csv}`, 'soonaverse_NFT_list.csv');
  }

  public async publish(): Promise<void> {
    if (!this.nfts?.length) return;
    
    await this.auth.sign(this.nfts, (sc, finish) => {
      this.notification.processRequest(this.nftApi.batchCreate(sc), 'Created.', finish).subscribe((val: any) => {
        this.router.navigate([ROUTER_UTILS.config.collection.root, this.collectionControl.value]);
      });
    });
  }

  public trackByName(index: number, item: any): number {
    return item.name;
  }

  public removeNft(index: number): void  {
    this.nfts = this.nfts.filter((nft: any, i: number) => i !== index);
  }
}
