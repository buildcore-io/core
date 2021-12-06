import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ROUTER_UTILS } from "@core/utils/router.utils";
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Subscription } from "rxjs";
import { DataService } from "../../services/data.service";
import { AwardApi, AwardParticipantWithMember } from './../../../../@api/award.api';
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { NotificationService } from './../../../../@core/services/notification/notification.service';
import { AuthService } from './../../../../components/auth/services/auth.service';

enum FilterOptions {
  PENDING = 'pending',
  ISSUED = 'issued'
}

@UntilDestroy()
@Component({
  selector: 'wen-participants',
  templateUrl: './participants.page.html',
  styleUrls: ['./participants.page.less']
})
export class ParticipantsPage implements OnInit, OnDestroy {
  public awardId?: string;
  public selectedListControl: FormControl = new FormControl(FilterOptions.PENDING);
  public pendingParticipants$: BehaviorSubject<AwardParticipantWithMember[]|undefined> = new BehaviorSubject<AwardParticipantWithMember[]|undefined>(undefined);
  public issuedParticipants$: BehaviorSubject<AwardParticipantWithMember[]|undefined> = new BehaviorSubject<AwardParticipantWithMember[]|undefined>(undefined);
  private subscriptions$: Subscription[] = [];
  private dataStorePending: AwardParticipantWithMember[][] = [];
  private dataStoreIssued: AwardParticipantWithMember[][] = [];
  constructor(
    private auth: AuthService,
    private awardApi: AwardApi,
    private router: Router,
    private route: ActivatedRoute,
    private notification: NotificationService,
    private cd: ChangeDetectorRef,
    public data: DataService
  ) {
    // none.
  }

  public ngOnInit(): void {
    this.route.parent?.params.subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.award.award.replace(':', '')];
      if (id) {
        this.cancelSubscriptions();
        this.awardId = id;
      } else {
        this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
      }
    });

    this.selectedListControl.valueChanges.pipe(untilDestroyed(this)).subscribe(() => {
      this.onScroll();
      this.cd.markForCheck();
    });

    // Load initial list.
    this.onScroll();
  }

  public onScroll(): void {
    if (!this.awardId) {
      return;
    }

    this.onParticipantScroll(this.awardId, this.selectedListControl.value);
  }

  public onParticipantScroll(awardId: string, list: FilterOptions): void {
    let store;
    let handler;
    let stream;
    if (list === FilterOptions.PENDING) {
      store = this.dataStorePending;
      stream = this.pendingParticipants$.value;
      handler = this.listenPendingParticipant;
    } else {
      store = this.dataStoreIssued;
      stream = this.issuedParticipants$.value;
      handler = this.listenIssuedParticipant;
    }

    // Make sure we allow initial load store[0]
    if (store[0] && (!store[store.length - 1] || store[store.length - 1]?.length < DEFAULT_LIST_SIZE)) {
      // Finished paging.
      return;
    }

    // For initial load stream will not be defiend.
    const lastValue = stream ? stream[stream.length - 1].createdOn : undefined;
    handler.call(this, awardId, lastValue);
  }

  public listenPendingParticipant(awardId: string, lastValue?: any): void {
    this.subscriptions$.push(this.awardApi.listenPendingParticipants(awardId, lastValue).subscribe(
      this.store.bind(this, this.pendingParticipants$, this.dataStorePending, this.dataStorePending.length)
    ));
  }

  public listenIssuedParticipant(awardId: string, lastValue?: any): void {
    this.subscriptions$.push(this.awardApi.listenIssuedParticipants(awardId, lastValue).subscribe(
      this.store.bind(this, this.issuedParticipants$, this.dataStoreIssued, this.dataStoreIssued.length)
    ));
  }

  protected store(stream$: BehaviorSubject<any[]|undefined>, store: any[][], page: number, a: any): void {
    if (store[page]) {
      store[page] = a;
    } else {
      store.push(a);
    }

    // Merge arrays.
    stream$.next(Array.prototype.concat.apply([], store));
  }

  public async approve(memberId: string): Promise<void> {
    const id: string | undefined = this.data.award$?.value?.uid;
    if (!id) {
      return;
    }

    await this.auth.sign({
      uid: id,
      member: memberId
    }, (sc, finish) => {
      this.notification.processRequest(this.awardApi.approveParticipant(sc), 'Approve.', finish).subscribe((val: any) => {
        // none.
      });
    });
  }

  public handleFilterChange(filter: FilterOptions): void {
    this.selectedListControl.setValue(filter);
    this.cd.markForCheck();
  }

  public get filterOptions(): typeof FilterOptions {
    return FilterOptions;
  }

  public getList(): BehaviorSubject<AwardParticipantWithMember[]|undefined> {
    if (this.selectedListControl.value === this.filterOptions.PENDING) {
      return this.pendingParticipants$;
    } else {
      return this.issuedParticipants$;
    }
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
    this.pendingParticipants$.next(undefined);
    this.issuedParticipants$.next(undefined);
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
