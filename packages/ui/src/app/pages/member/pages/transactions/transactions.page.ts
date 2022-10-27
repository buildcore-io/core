import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { DEFAULT_LIST_SIZE, FULL_TODO_CHANGE_TO_PAGING } from '@api/base.api';
import { MemberApi } from '@api/member.api';
import { DeviceService } from '@core/services/device';
import { TransactionService } from '@core/services/transaction';
import { UnitsService } from '@core/services/units';
import { download } from '@core/utils/tools.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/member/services/data.service';
import { HelperService } from '@pages/member/services/helper.service';
import { Transaction } from '@soon/interfaces';
import Papa from 'papaparse';
import { BehaviorSubject, first, map, Observable, of, Subscription } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsPage implements OnInit, OnDestroy {
  public transactions$: BehaviorSubject<Transaction[] | undefined> = new BehaviorSubject<
    Transaction[] | undefined
  >(undefined);
  public exportingTransactions = false;
  private dataStore: Transaction[][] = [];
  private subscriptions$: Subscription[] = [];

  constructor(
    public deviceService: DeviceService,
    public transactionService: TransactionService,
    public helper: HelperService,
    public unitsService: UnitsService,
    private data: DataService,
    private memberApi: MemberApi,
    private cd: ChangeDetectorRef,
  ) {}

  public ngOnInit(): void {
    this.data.member$?.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (obj) {
        this.listen();
      }
    });
  }

  public getDebugInfo(tran: Transaction | undefined | null): string {
    let msg = `uid: ${tran?.uid}, tries: ${tran?.payload?.walletReference?.count || 0}`;
    if (tran?.payload?.walletReference?.error) {
      msg += `, error: "${tran?.payload?.walletReference?.error}"`;
    }

    return msg;
  }

  private listen(): void {
    this.cancelSubscriptions();
    this.transactions$.next(undefined);
    this.subscriptions$.push(this.getHandler(undefined).subscribe(this.store.bind(this, 0)));
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return Array.isArray(arr) && arr.length === 0;
  }

  public getHandler(last?: any): Observable<Transaction[]> {
    if (this.data.member$.value) {
      return this.memberApi.topTransactions(
        this.data.member$.value.uid,
        undefined,
        last,
        FULL_TODO_CHANGE_TO_PAGING,
      );
    } else {
      return of([]);
    }
  }

  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.transactions$.value) {
      return;
    }

    // We reached maximum.
    if (
      !this.dataStore[this.dataStore.length - 1] ||
      this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE
    ) {
      return;
    }

    // Def order field.
    const lastValue = this.transactions$.value[this.transactions$.value.length - 1]._doc;
    this.subscriptions$.push(
      this.getHandler(lastValue).subscribe(this.store.bind(this, this.dataStore.length)),
    );
  }

  protected store(page: number, a: any): void {
    if (this.dataStore[page]) {
      this.dataStore[page] = a;
    } else {
      this.dataStore.push(a);
    }

    // Merge arrays.
    this.transactions$.next(Array.prototype.concat.apply([], this.dataStore));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.transactions$.pipe(
      map(() => {
        if (!this.dataStore[this.dataStore.length - 1]) {
          return true;
        }

        return (
          !this.dataStore[this.dataStore.length - 1] ||
          this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE
        );
      }),
    );
  }

  public exportTransactions(): void {
    if (!this.data.member$.value?.uid) return;
    this.exportingTransactions = true;
    this.memberApi
      .topTransactions(
        this.data.member$.value?.uid,
        undefined,
        undefined,
        FULL_TODO_CHANGE_TO_PAGING,
      )
      .pipe(first(), untilDestroyed(this))
      .subscribe((transactions: Transaction[]) => {
        this.exportingTransactions = false;
        const fields = ['', 'tranId', 'type', 'date', 'amount', 'tangle'];
        const csv = Papa.unparse({
          fields,
          data: transactions.map((t) => [
            t.uid,
            this.transactionService.getTitle(t),
            t.createdOn?.toDate(),
            t.payload.amount,
            this.transactionService.getExplorerLink(),
          ]),
        });

        download(
          `data:text/csv;charset=utf-8${csv}`,
          `soonaverse_${this.data.member$.value?.uid}_transactions.csv`,
        );
        this.cd.markForCheck();
      });
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