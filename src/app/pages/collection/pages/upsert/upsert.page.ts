import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AwardApi, AwardFilter } from '@api/award.api';
import { CollectionApi } from '@api/collection.api';
import { FileApi } from '@api/file.api';
import { MemberApi } from '@api/member.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { NavigationService } from '@core/services/navigation/navigation.service';
import { NotificationService } from '@core/services/notification';
import { enumToArray } from '@core/utils/manipulations.utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Units } from '@core/utils/units-helper';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as dayjs from 'dayjs';
import {
  DISCORD_REGEXP,
  TWITTER_REGEXP,
  URL_REGEXP
} from 'functions/interfaces/config';
import {
  Award,
  Categories,
  CollectionType,
  Space
} from 'functions/interfaces/models';
import { PRICE_UNITS } from 'functions/interfaces/models/nft';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import {
  NzUploadChangeParam,
  NzUploadFile,
  NzUploadXHRArgs
} from 'ng-zorro-antd/upload';
import { BehaviorSubject, Observable, of, Subscription } from 'rxjs';
import { first } from 'rxjs/operators';
import { SelectSpaceOption } from '../../../../components/space/components/select-space/select-space.component';
import {
  CollectionAccess,
  DiscountLine
} from './../../../../../../functions/interfaces/models/collection';

const MAX_DISCOUNT_COUNT = 3;

@UntilDestroy()
@Component({
  selector: 'wen-upsert',
  templateUrl: './upsert.page.html',
  styleUrls: ['./upsert.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpsertPage implements OnInit, OnDestroy {
  public nameControl: FormControl = new FormControl('', Validators.required);
  public descriptionControl: FormControl = new FormControl(
    '',
    Validators.required,
  );
  public royaltiesFeeControl: FormControl = new FormControl(
    '',
    Validators.required,
  );
  public urlControl: FormControl = new FormControl(
    '',
    Validators.pattern(URL_REGEXP),
  );
  public twitterControl: FormControl = new FormControl(
    '',
    Validators.pattern(TWITTER_REGEXP),
  );
  public discordControl: FormControl = new FormControl(
    '',
    Validators.pattern(DISCORD_REGEXP),
  );
  public placeholderUrlControl: FormControl = new FormControl('');
  public accessAwardsControl: FormControl = new FormControl([]);
  public bannerUrlControl: FormControl = new FormControl('', Validators.required);
  public categoryControl: FormControl = new FormControl('', Validators.required);
  public selectedAccessControl: FormControl = new FormControl(CollectionAccess.OPEN, Validators.required);
  public spaceControl: FormControl = new FormControl('', Validators.required);
  public royaltiesSpaceControl: FormControl = new FormControl(
    '',
    Validators.required,
  );
  public royaltiesSpaceDifferentControl: FormControl = new FormControl(
    false,
    Validators.required,
  );
  public typeControl: FormControl = new FormControl(
    CollectionType.CLASSIC,
    Validators.required,
  );
  public priceControl: FormControl = new FormControl('', [
    Validators.required,
    Validators.min(0),
    Validators.max(1000),
  ]);
  public unitControl: FormControl = new FormControl(
    PRICE_UNITS[0],
    Validators.required,
  );
  public availableFromControl: FormControl = new FormControl(
    '',
    Validators.required,
  );
  public discounts: FormArray;
  public collectionForm: FormGroup;
  public editMode = false;
  public collectionId?: number;
  public collectionTypes = enumToArray(CollectionType);
  public collectionCategories = enumToArray(Categories);
  public formatterPercent = (value: number): string => `${value} %`;
  public parserPercent = (value: string): string => value.replace(' %', '');
  public uploadedBanner?: NzUploadFile | null;
  public uploadedPlaceholder?: NzUploadFile | null;
  public awards$: BehaviorSubject<Award[] | undefined> = new BehaviorSubject<
    Award[] | undefined
  >(undefined);
  public spaces$: BehaviorSubject<Space[]> = new BehaviorSubject<Space[]>([]);
  private awardSub?: Subscription;

  constructor(
    public deviceService: DeviceService,
    public nav: NavigationService,
    private route: ActivatedRoute,
    private collectionApi: CollectionApi,
    private cd: ChangeDetectorRef,
    private memberApi: MemberApi,
    private notification: NotificationService,
    private auth: AuthService,
    private router: Router,
    private nzNotification: NzNotificationService,
    private fileApi: FileApi,
    private awardApi: AwardApi,
  ) {
    this.discounts = new FormArray([]);
    this.collectionForm = new FormGroup({
      name: this.nameControl,
      description: this.descriptionControl,
      space: this.spaceControl,
      type: this.typeControl,
      access: this.selectedAccessControl,
      accessAwards: this.accessAwardsControl,
      price: this.priceControl,
      unit: this.unitControl,
      availableFrom: this.availableFromControl,
      royaltiesFee: this.royaltiesFeeControl,
      royaltiesSpace: this.royaltiesSpaceControl,
      royaltiesSpaceDifferent: this.royaltiesSpaceDifferentControl,
      url: this.urlControl,
      twitter: this.twitterControl,
      discord: this.discordControl,
      bannerUrl: this.bannerUrlControl,
      placeholderUrl: this.placeholderUrlControl,
      category: this.categoryControl,
      discounts: this.discounts,
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
        this.collectionApi
          .listen(o.collectionId)
          .pipe(first())
          .subscribe((o) => {
            if (!o) {
              this.nav.goBack();
            } else {
              this.nameControl.setValue(o.name);
              this.descriptionControl.setValue(o.description);
              this.spaceControl.setValue(o.space);
              this.descriptionControl.setValue(o.description);
              this.typeControl.setValue(o.type);
              this.priceControl.setValue(o.price / 1000 / 1000);
              this.availableFromControl.setValue(o.availableFrom.toDate());
              this.royaltiesFeeControl.setValue(o.royaltiesFee * 100);
              this.royaltiesSpaceControl.setValue(o.royaltiesSpace);
              this.royaltiesSpaceDifferentControl.setValue(
                o.royaltiesSpace !== o.space,
              );
              this.placeholderUrlControl.setValue(o.bannerUrl);
              this.bannerUrlControl.setValue(o.bannerUrl);
              this.twitterControl.setValue(o.twitter);
              this.discordControl.setValue(o.discord);
              this.categoryControl.setValue(o.category);
              this.discounts.removeAt(0);
              o.discounts.forEach((v) => {
                this.addDiscount(
                  v.xp ? v.xp.toString() : '',
                  v.amount ? (v.amount * 100).toString() : '',
                );
              });

              // Disable fields that are not editable.
              this.spaceControl.disable();
              this.selectedAccessControl.disable();
              this.accessAwardsControl.disable();
              this.priceControl.disable();
              this.unitControl.disable();
              this.availableFromControl.disable();
              this.typeControl.disable();
              this.categoryControl.disable();

              this.cd.markForCheck();
            }
          });
      }
    });

    this.auth.member$.pipe(untilDestroyed(this)).subscribe((o) => {
      if (o?.uid) {
        this.memberApi
          .allSpacesAsMember(o.uid)
          .pipe(untilDestroyed(this))
          .subscribe(this.spaces$);
      }
    });

    // Listen to main space and make sure we always set it as royalty spce.
    this.spaceControl.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe((val) => {
        if (this.royaltiesSpaceDifferentControl.value === false) {
          this.royaltiesSpaceControl.setValue(val);
        }

        if (val) {
          this.awardSub?.unsubscribe();
          this.awardSub = this.awardApi
            .listenSpace(val, AwardFilter.ALL)
            .subscribe(this.awards$);
        }
      });
  }

  public get maxDiscountCount(): number {
    return MAX_DISCOUNT_COUNT;
  }

  private memberIsLoggedOut(item: NzUploadXHRArgs): Subscription {
    const err = 'Member seems to log out during the file upload request.';
    this.nzNotification.error(err, '');
    if (item.onError) {
      item.onError(err, item.file);
    }

    return of().subscribe();
  }

  public uploadFilePlaceholder(item: NzUploadXHRArgs): Subscription {
    if (!this.auth.member$.value) {
      return this.memberIsLoggedOut(item);
    }

    return this.fileApi.upload(
      this.auth.member$.value.uid,
      item,
      'nft_placeholder',
    );
  }

  public uploadFileBanner(item: NzUploadXHRArgs): Subscription {
    if (!this.auth.member$.value) {
      return this.memberIsLoggedOut(item);
    }

    return this.fileApi.upload(
      this.auth.member$.value.uid,
      item,
      'collection_banner',
    );
  }

  public get targetAccess(): typeof CollectionAccess {
    return CollectionAccess;
  }

  public uploadChangePlaceholder(event: NzUploadChangeParam): void {
    if (event.type === 'success') {
      this.placeholderUrlControl.setValue(event.file.response);
      this.uploadedPlaceholder = event.file;
    } else {
      this.placeholderUrlControl.setValue('');
    }
  }

  public uploadChangeBanner(event: NzUploadChangeParam): void {
    if (event.type === 'success') {
      this.bannerUrlControl.setValue(event.file.response);
      this.uploadedBanner = event.file;
    } else {
      this.bannerUrlControl.setValue('');
    }
  }

  public showPlaceholder(): boolean {
    return this.typeControl.value !== CollectionType.CLASSIC;
  }

  public previewFile(file: NzUploadFile): Observable<string> {
    return of(file.response);
  }

  public getSpaceListOptions(list?: Space[] | null): SelectSpaceOption[] {
    return (list || [])
      .filter((o) => {
        return !!o.validatedAddress;
      })
      .map((o) => ({
        label: o.name || o.uid,
        value: o.uid,
        img: o.avatarUrl,
      }));
  }

  private validateForm(): boolean {
    this.collectionForm.updateValueAndValidity();
    if (!this.collectionForm.valid) {
      Object.values(this.collectionForm.controls).forEach((control) => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      return false;
    }

    return true;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public getTooltip(type: number, tooltip: string): string {
    type === 0
      ? (tooltip =
          'Classic NFTs are the most straightforward in that you upload your images, they’re all visible right away, and people can browse through your collection and purchase what they like. Simply upload and sell!')
      : type === 1
      ? (tooltip =
          'Generated NFTs add a little mystery into the mix. The buyer won’t know what their NFT looks like until they mint it. The owner of the collection has the ability to put in a placeholder image for the entire collection to give the buyer an idea of what the NFT may look like, but their mint will still be a surprise. This is the most common type of NFT (it’s what IOTABOTs did).')
      : (tooltip =
          'SFTs (Semi-Fungible Tokens) are a hybrid between the two approaches above. The collection creator can create a classic NFT, but they have the option to multiply them. For example, they can upload 10 images, but each image will have a quantity of 100. This is a relatively new term in the space, but a good real world example of this approach would be baseball or football trading cards.');

    return tooltip;
  }

  public get priceUnits(): Units[] {
    return PRICE_UNITS;
  }

  public disabledStartDate(startValue: Date): boolean {
    // Disable past dates & today + 1day startValue
    if (startValue.getTime() < dayjs().subtract(1, 'day').toDate().getTime()) {
      return true;
    }

    return false;
  }

  public formatSubmitData(data: any, mode: 'create' | 'edit' = 'create'): any {
    if (data.price) {
      if (<Units>data.unit === 'Gi') {
        data.price = data.price * 1000 * 1000 * 1000;
      } else {
        data.price = data.price * 1000 * 1000;
      }
    }
    const discounts: DiscountLine[] = [];
    data.discounts.forEach((v: DiscountLine) => {
      if (v.amount > 0 && v.xp > 0) {
        discounts.push({
          xp: v.xp,
          amount: v.amount / 100,
        });
      }
    });
    data.discounts = discounts;

    // Convert royaltiesFee
    if (data.royaltiesFee > 0) {
      data.royaltiesFee = data.royaltiesFee / 100;
    } else {
      data.royaltiesFee = 0;
    }

    if (mode === 'edit') {
      delete data.spaceControl;
      delete data.typeControl;
      delete data.categoryControl;
      delete data.access;
    }

    delete data.royaltiesSpaceDifferent;
    delete data.unit;
    return data;
  }

  public async create(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }
    await this.auth.sign(
      this.formatSubmitData({ ...this.collectionForm.value }),
      (sc, finish) => {
        this.notification
          .processRequest(this.collectionApi.create(sc), 'Created.', finish)
          .subscribe((val: any) => {
            this.router.navigate([
              ROUTER_UTILS.config.collection.root,
              val?.uid,
            ]);
          });
      },
    );
  }

  public async save(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }
    await this.auth.sign(
      {
        ...this.formatSubmitData({ ...this.collectionForm.value }, 'edit'),
        ...{
          uid: this.collectionId,
        },
      },
      (sc, finish) => {
        this.notification
          .processRequest(this.collectionApi.update(sc), 'Saved.', finish)
          .subscribe((val: any) => {
            this.router.navigate([
              ROUTER_UTILS.config.collection.root,
              val?.uid,
            ]);
          });
      },
    );
  }

  public trackByValue(index: number, item: any): number {
    return item.value;
  }

  // TODO implement validation.
  private getDiscountForm(xp = '', amount = ''): FormGroup {
    return new FormGroup({
      xp: new FormControl(xp),
      amount: new FormControl(amount),
    });
  }

  public addDiscount(xp = '', amount = ''): void {
    if (this.discounts.controls.length < MAX_DISCOUNT_COUNT) {
      this.discounts.push(this.getDiscountForm(xp, amount));
    }
  }

  public removeDiscount(index: number): void {
    this.discounts.removeAt(index);
  }

  public gForm(f: any, value: string): any {
    return f.get(value);
  }

  public ngOnDestroy(): void {
    this.awardSub?.unsubscribe();
  }
}
