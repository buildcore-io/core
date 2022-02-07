import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionApi } from '@api/collection.api';
import { FileApi } from '@api/file.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { NavigationService } from '@core/services/navigation/navigation.service';
import { NotificationService } from '@core/services/notification';
import { enumToArray } from '@core/utils/manipulations.utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DISCORD_REGEXP, TWITTER_REGEXP, URL_REGEXP } from 'functions/interfaces/config';
import { Categories, CollectionType } from 'functions/interfaces/models';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzUploadChangeParam, NzUploadFile, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { Observable, of, Subscription } from 'rxjs';
import { first } from 'rxjs/operators';

const MAX_DISCOUNT_COUNT = 5;

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
  public typeControl: FormControl = new FormControl(CollectionType.CLASSIC);
  public discounts: FormArray;
  public collectionForm: FormGroup;
  public editMode = false;
  public collectionId?: number;
  public collectionTypes = enumToArray(CollectionType);
  public collectionCategories = enumToArray(Categories);

  
  constructor(
    public deviceService: DeviceService,
    public nav: NavigationService,
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
      royaltiesFee: this.royaltiesFeeControl,
      url: this.urlControl,
      twitter: this.twitterControl,
      discord: this.discordControl,
      bannerUrl: this.bannerUrlControl,
      category: this.categoryControl,
      discounts: this.discounts
    });
  }

  public ngOnInit(): void {
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
            this.royaltiesFeeControl.setValue(o.royaltiesFee);
            this.bannerUrlControl.setValue(o.bannerUrl); 
            // this.urlControl.setValue(o.url);
            // this.twitterControl.setValue(o.twitter);
            // this.discordControl.setValue(o.discordControl);
            // this.categoryControl.setValue(o.category);
            // this.discountControl.setValue(o.discount);
            this.cd.markForCheck();
          }
        });
      }
    });
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

  public async create(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }
    await this.auth.sign(this.collectionForm.value, (sc, finish) => {
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
      ...this.collectionForm.value,
      ...{
        uid: this.collectionId
      }
    }, (sc, finish) => {
      // "save" function not implemented
      // this.notification.processRequest(this.collectionApi.save(sc), 'Saved.', finish).subscribe((val: any) => {
      //   this.router.navigate([ROUTER_UTILS.config.collection.root, val?.uid]);
      // });
    });
  }

  public trackByValue(index: number, item: any): number {
    return item.value;
  }

  private getDiscountForm(): FormGroup {
    return new FormGroup({
      xp: new FormControl('', Validators.required),
      amount: new FormControl('', Validators.required)
    });
  }

  public addDiscount(): void {
    if (this.discounts.controls.length < MAX_DISCOUNT_COUNT){
      this.discounts.push(this.getDiscountForm());
    }
  }

  public removeDiscount(questionIndex: number): void {
    if (this.discounts.controls.length > 1) {
      this.discounts.removeAt(questionIndex);
    }
  }

  public gForm(f: any, value: string): any {
    return f.get(value);
  }
}
