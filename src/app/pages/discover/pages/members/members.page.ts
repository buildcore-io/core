import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { SelectBoxOption } from '@components/select-box/select-box.component';
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';
import { SortOptions } from "../../services/sort-options.interface";
import { Member } from './../../../../../../functions/interfaces/models/member';
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { MemberApi } from './../../../../@api/member.api';
import { FilterService } from './../../services/filter.service';

export const DEFAULT_SPACE: SelectBoxOption = {
  label: 'All',
  value: 'all'
};

@UntilDestroy()
@Component({
  templateUrl: './members.page.html',
  styleUrls: ['./members.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersPage implements OnInit, OnDestroy {
  public sortControl: FormControl;
  public spaceForm: FormGroup;
  public spacesList: SelectBoxOption[] = [DEFAULT_SPACE, 
    { label: 'Space 1', value: 'space1', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 2', value: 'space2', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 3', value: 'space3', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 4', value: 'space4', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 5', value: 'space5', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 6', value: 'space6', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 7', value: 'space7', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 8', value: 'space8', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 9', value: 'space9', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 10', value: 'space10', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 11', value: 'space11', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 12', value: 'space12', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 13', value: 'space13', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 14', value: 'space14', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 15', value: 'space15', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 16', value: 'space16', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 17', value: 'space17', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 18', value: 'space18', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 19', value: 'space19', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 20', value: 'space20', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 21', value: 'space21', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 22', value: 'space22', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 23', value: 'space23', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 24', value: 'space24', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 25', value: 'space25', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 26', value: 'space26', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 27', value: 'space27', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 28', value: 'space28', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 29', value: 'space29', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 30', value: 'space30', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 31', value: 'space31', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 32', value: 'space32', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 33', value: 'space33', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 34', value: 'space34', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 35', value: 'space35', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 36', value: 'space36', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }
  ];
  public members$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  public defaultSpace = DEFAULT_SPACE;
  private dataStore: Member[][] = [];
  private subscriptions$: Subscription[] = [];
  constructor(
    private memberApi: MemberApi, 
    public filter: FilterService,
    public deviceService: DeviceService
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
    this.spaceForm = new FormGroup({
      space: new FormControl(DEFAULT_SPACE.value),
      includeAlliances: new FormControl(false)
    });
  }

  public ngOnInit(): void {
    this.listen();
    this.filter.selectedSort$.pipe(skip(1), untilDestroyed(this)).subscribe(() => {
      this.listen();
    });

    this.filter.search$.pipe(skip(1), untilDestroyed(this)).subscribe((val: any) => {
      if (val && val.length > 0) {
        this.listen(val);
      } else {
        this.listen();
      }
    });

    this.sortControl.valueChanges.pipe(untilDestroyed(this)).subscribe((val: any) => {
      this.filter.selectedSort$.next(val);
    });
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.getHandler(undefined, search).subscribe(this.store.bind(this, 0)));
  }

  public getHandler(last?: any, search?: string): Observable<Member[]> {
    if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
      return this.memberApi.last(last, search);
    } else {
      return this.memberApi.top(last, search);
    }
  }

  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.members$.value) {
      return;
    }

    // We reached maximum.
    if ((!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE)) {
      return;
    }

    this.subscriptions$.push(this.getHandler(this.members$.value[this.members$.value.length - 1].createdOn).subscribe(this.store.bind(this, this.dataStore.length)));
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  protected store(page: number, a: any): void {
    if (this.dataStore[page]) {
      this.dataStore[page] = a;
    } else {
      this.dataStore.push(a);
    }

    // Merge arrays.
    this.members$.next(Array.prototype.concat.apply([], this.dataStore));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.members$.pipe(map(() => {
      if (!this.dataStore[this.dataStore.length - 1]) {
        return true;
      }

      return (!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE);
    }));
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });

    this.dataStore = [];
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
