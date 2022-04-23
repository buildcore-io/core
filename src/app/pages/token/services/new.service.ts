import { Injectable } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { FileApi } from '@api/file.api';
import { AuthService } from '@components/auth/services/auth.service';
import { SelectSpaceOption } from '@components/space/components/select-space/select-space.component';
import { Space } from '@functions/interfaces/models';
import dayjs from 'dayjs';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzUploadChangeParam, NzUploadXHRArgs } from 'ng-zorro-antd/upload';
import { BehaviorSubject, of, Subscription } from 'rxjs';

export const MAX_ALLOCATIONS_COUNT = 100;
export const MAX_LINKS_COUNT = 20;

export interface TokenBreakdownItem {
  label: string;
  value: string;
  extra?: string;
};

@Injectable({
  providedIn: 'any'
})
export class NewService {

  public distributionOptions = [
    { label: $localize`Fixed price`, value: 'fixed' }
  ];
  public breakdownData: TokenBreakdownItem[] = [
    { label: 'Total token supply', value: '100 000' },
    { label: 'Price per token', value: '1 Mi' },
    { label: 'Treasury', value: '50%', extra: '(50 000 Mi)' },
    { label: 'Development fund', value: '20%', extra: '(20 000 Mi)' }
  ]
  public offeringLengthOptions = Array.from({length: 10}, (_, i) => i + 1)
  public maxAllocationsCount = MAX_ALLOCATIONS_COUNT;
  public maxLinksCount = MAX_LINKS_COUNT;  

  public nameControl: FormControl = new FormControl('', Validators.required);
  public symbolControl: FormControl = new FormControl('', Validators.required);
  public startDateControl: FormControl = new FormControl('', Validators.required);
  public offerLengthControl: FormControl = new FormControl(2, [Validators.required, Validators.min(1)]);
  public priceControl: FormControl = new FormControl('', Validators.required);
  public totalSupplyControl: FormControl = new FormControl('', Validators.required);
  public spaceControl: FormControl = new FormControl('', Validators.required);
  public iconControl: FormControl = new FormControl('', Validators.required);
  public distributionControl: FormControl = new FormControl('fixed', Validators.required);
  public titleControl: FormControl = new FormControl('', Validators.required);
  public descriptionControl: FormControl = new FormControl('', Validators.required);
  public introductionaryControl: FormControl = new FormControl('', Validators.required);
  
  public allocations: FormArray;
  public links: FormArray;
  public tokenForm: FormGroup;
  public spaces$: BehaviorSubject<Space[]> = new BehaviorSubject<Space[]>([]);

  constructor(
    private nzNotification: NzNotificationService,
    private fileApi: FileApi,
    private auth: AuthService
  ) {
    this.allocations = new FormArray([]);
    this.links = new FormArray([]);

    this.tokenForm = new FormGroup({
      name: this.nameControl,
      symbol: this.symbolControl,
      startDate: this.startDateControl,
      offerLength: this.offerLengthControl,
      price: this.priceControl,
      totalSupply: this.totalSupplyControl,
      space: this.spaceControl,
      icon: this.iconControl,
      distribution: this.distributionControl,
      title: this.titleControl,
      description: this.descriptionControl,
      introductionary: this.introductionaryControl,
      allocations: this.allocations,
      links: this.links
    });

    this.addAllocation();
    this.addLink();
  }

  private getAllocationForm(title = '', percentage = '', publicSale = false): FormGroup {
    return new FormGroup({
      title: new FormControl(title, Validators.required),
      percentage: new FormControl(percentage, Validators.required),
      publicSale: new FormControl(publicSale)
    });
  }

  public addAllocation(title = '', percentage = '', publicSale = false): void {
    if (this.allocations.controls.length < MAX_ALLOCATIONS_COUNT) {
      this.allocations.push(this.getAllocationForm(title, percentage || (this.allocations.length === 0 ? '100' : ''), publicSale));
    }
  }

  public removeAllocation(index: number): void {
    this.allocations.removeAt(index);
  }

  private getLinkForm(url = ''): FormGroup {
    return new FormGroup({
      url: new FormControl(url, Validators.required)
    });
  }

  public addLink(url = ''): void {
    if (this.links.controls.length < MAX_LINKS_COUNT) {
      this.links.push(this.getLinkForm(url));
    }
  }

  public removeLink(index: number): void {
    this.links.removeAt(index);
  }

  public gForm(f: any, value: string): any {
    return f.get(value);
  }

  public disabledStartDate(startValue: Date): boolean {
    // Disable past dates & today + 1day startValue
    if (startValue.getTime() < dayjs().toDate().getTime()) {
      return true;
    }

    return false;
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

  public uploadChangeIcon(event: NzUploadChangeParam): void {
    this.uploadChange('token_icon', event);
  }

  public uploadChangeIntroductionary(event: NzUploadChangeParam): void {
    this.uploadChange('token_introductionary', event);
  }

  private uploadChange(type: 'token_icon' | 'token_introductionary', event: NzUploadChangeParam): void {
    if (event.type === 'success') {
      if (type === 'token_icon') {
        this.iconControl.setValue(event.file.response);
      } else if (type === 'token_introductionary') {
        this.introductionaryControl.setValue(event.file.response);
      }
    }
  }

  public uploadFile(type: 'token_icon' | 'token_introductionary', item: NzUploadXHRArgs): Subscription {
    if (!this.auth.member$.value) {
      const err = $localize`Member seems to log out during the file upload request.`;
      this.nzNotification.error(err, '');
      if (item.onError) {
        item.onError(err, item.file);
      }

      return of().subscribe();
    }

    return this.fileApi.upload(this.auth.member$.value.uid, item, type);
  }

  public getAllocationTitle(index: number): string {
    return $localize`Allocation` + ` #${index >= 10 ? index : '0' + index}`;
  }
}
