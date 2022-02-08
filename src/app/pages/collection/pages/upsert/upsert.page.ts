import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionApi } from '@api/collection.api';
import { FileApi } from '@api/file.api';
import { AuthService } from '@components/auth/services/auth.service';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { NavigationService } from '@core/services/navigation/navigation.service';
import { NotificationService } from '@core/services/notification';
import { enumToArray } from '@core/utils/manipulations.utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DISCORD_REGEXP, TWITTER_REGEXP, URL_REGEXP } from 'functions/interfaces/config';
import { Categories, CollectionType, Space } from 'functions/interfaces/models';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzUploadChangeParam, NzUploadFile, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { Observable, of, Subscription } from 'rxjs';
import { first } from 'rxjs/operators';
import { DiscountLine } from './../../../../../../functions/interfaces/models/collection';
import { SelectSpaceOption } from './../../../../components/select-space/select-space.component';

const MAX_DISCOUNT_COUNT = 3;

@UntilDestroy()
@Component({
  selector: 'wen-upsert',
  templateUrl: './upsert.page.html',
  styleUrls: ['./upsert.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpsertPage implements OnInit {
  public nameControl: FormControl = new FormControl('', Validators.required);
  public descriptionControl: FormControl = new FormControl('', Validators.required);
  public royaltiesFeeControl: FormControl = new FormControl('', Validators.required);
  public urlControl: FormControl = new FormControl('', Validators.pattern(URL_REGEXP));
  public twitterControl: FormControl = new FormControl('', Validators.pattern(TWITTER_REGEXP));
  public discordControl: FormControl = new FormControl('', Validators.pattern(DISCORD_REGEXP));
  public bannerUrlControl: FormControl = new FormControl('');
  public categoryControl: FormControl = new FormControl('', Validators.required);
  public spaceControl: FormControl = new FormControl('', Validators.required);
  public royaltiesSpaceControl: FormControl = new FormControl('', Validators.required);
  public royaltiesSpaceDifferentControl: FormControl = new FormControl(false, Validators.required);
  public typeControl: FormControl = new FormControl(CollectionType.CLASSIC, Validators.required);
  public discounts: FormArray;
  public collectionForm: FormGroup;
  public editMode = false;
  public collectionId?: number;
  public collectionTypes = enumToArray(CollectionType);
  public collectionCategories = enumToArray(Categories);
  public formatterPercent = (value: number): string => `${value} %`;
  public parserPercent = (value: string): string => value.replace(' %', '');

  constructor(
    public deviceService: DeviceService,
    public nav: NavigationService,
    public cache: CacheService,
    private route: ActivatedRoute,
    private collectionApi: CollectionApi,
    private cd: ChangeDetectorRef,
    private notification: NotificationService,
    private auth: AuthService,
    private router: Router,
    private nzNotification: NzNotificationService,
    private fileApi: FileApi
  ) {
    this.discounts = new FormArray([
      this.getDiscountForm()
    ]);

    this.collectionForm = new FormGroup({
      name: this.nameControl,
      description: this.descriptionControl,
      space: this.spaceControl,
      type: this.typeControl,
      royaltiesFee: this.royaltiesFeeControl,
      royaltiesSpace: this.royaltiesSpaceControl,
      royaltiesSpaceDifferent: this.royaltiesSpaceDifferentControl,
      url: this.urlControl,
      twitter: this.twitterControl,
      discord: this.discordControl,
      bannerUrl: this.bannerUrlControl,
      category: this.categoryControl,
      discounts: this.discounts
    });
  }

  public ngOnInit(): void {
    this.route.params.pipe(untilDestroyed(this)).subscribe((p) => {
      if (p.space) {
        this.spaceControl.setValue(p.space);
        this.royaltiesSpaceControl.setValue(p.space);
      }
    });

    this.route.params.pipe(untilDestroyed(this)).subscribe((o) => {
      if (o?.collectionId) {
        this.editMode = true;
        this.collectionId = o.collectionId;
        this.collectionApi.listen(o.collectionId).pipe(first()).subscribe((o) => {
          if (!o) {
            this.nav.goBack();
          } else {
            this.nameControl.setValue(o.name);
            this.descriptionControl.setValue(o.description);
            this.spaceControl.setValue(o.space);
            this.descriptionControl.setValue(o.description);
            this.typeControl.setValue(o.type);
            this.royaltiesFeeControl.setValue(o.royaltiesFee);
            this.royaltiesSpaceControl.setValue(o.royaltiesSpace);
            this.royaltiesSpaceDifferentControl.setValue(o.royaltiesSpace !== o.space);
            this.bannerUrlControl.setValue(o.bannerUrl);
            this.twitterControl.setValue(o.twitter);
            this.discordControl.setValue(o.discord);
            this.bannerUrlControl.setValue(o.bannerUrl);
            this.categoryControl.setValue(o.category);
            this.discounts.removeAt(0);
            o.discounts.forEach((v) => {
              this.addDiscount(v.xp ? v.xp.toString() : '', v.amount ? v.amount.toString() : '');
            });

            // Disable fields that are not editable.
            this.spaceControl.disable();
            this.typeControl.disable();
            this.categoryControl.disable();

            this.cd.markForCheck();
          }
        });
      }
    });

    // Listen to main space and make sure we always set it as royalty spce.
    this.spaceControl.valueChanges.pipe(untilDestroyed(this)).subscribe((val) => {
      if (this.royaltiesSpaceDifferentControl.value === false) {
        this.royaltiesSpaceControl.setValue(val);
      }
    });
  }

  public get maxDiscountCount(): number {
    return MAX_DISCOUNT_COUNT;
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

    return this.fileApi.upload(this.auth.member$.value.uid, item, 'collection_banner');
  }

  public uploadChange(event: NzUploadChangeParam): void {
    if (event.type === 'success') {
      this.bannerUrlControl.setValue(event.file.response);
    }
  }

  public previewFile(file: NzUploadFile): Observable<string> {
    return of(file.response);
  };

  public getSpaceListOptions(list?: Space[] | null): SelectSpaceOption[] {
    return (list || []).map((o) => ({
        label: o.name || o.uid,
        value: o.uid,
        img: o.avatarUrl
    }));
  }

  private validateForm(): boolean {
    this.collectionForm.updateValueAndValidity();
    if (!this.collectionForm.valid) {
      Object.values(this.collectionForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      return false;
    }

    return true;
  }

  public formatSubmitData(data: any, mode: 'create'|'edit' = 'create'): any {
    delete data.royaltiesSpaceDifferent;
    const discounts: DiscountLine[] = [];
    data.discounts.forEach((v: DiscountLine) => {
      if (v.amount > 0 && v.xp > 0) {
        discounts.push(v);
      }
    });
    data.discounts = discounts;

    // Convert royaltiesFee
    if (data.royaltiesFee > 0) {
      data.royaltiesFee = data.royaltiesFee / 100;
    }

    if (mode === 'edit') {
      delete data.spaceControl;
      delete data.typeControl;
      delete data.categoryControl;
    }

    return data;
  }

  public async create(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }
    await this.auth.sign(this.formatSubmitData({...this.collectionForm.value}), (sc, finish) => {
      this.notification.processRequest(this.collectionApi.create(sc), 'Created.', finish).subscribe((val: any) => {
        this.router.navigate([ROUTER_UTILS.config.collection.root, val?.uid]);
      });
    });
  }

  public async save(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }
    await this.auth.sign({
      ...this.formatSubmitData({...this.collectionForm.value}, 'edit'),
      ...{
        uid: this.collectionId
      }
    }, (sc, finish) => {
      this.notification.processRequest(this.collectionApi.update(sc), 'Saved.', finish).subscribe((val: any) => {
        this.router.navigate([ROUTER_UTILS.config.collection.root, val?.uid]);
      });
    });
  }

  public trackByValue(index: number, item: any): number {
    return item.value;
  }

  // TODO implement validation.
  private getDiscountForm(xp = '', amount = ''): FormGroup {
    return new FormGroup({
      xp: new FormControl(xp),
      amount: new FormControl(amount)
    });
  }

  public addDiscount(xp = '', amount = ''): void {
    if (this.discounts.controls.length < MAX_DISCOUNT_COUNT){
      this.discounts.push(this.getDiscountForm(xp, amount));
    }
  }

  public removeDiscount(index: number): void {
    if (this.discounts.controls.length > 1) {
      this.discounts.removeAt(index);
    }
  }

  public gForm(f: any, value: string): any {
    return f.get(value);
  }
}
