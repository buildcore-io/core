import { Injectable } from '@angular/core';
import { SelectBoxOption } from '@components/select-box/select-box.component';
import { Award, Space } from 'functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';
import { Member } from './../../../../../functions/interfaces/models/member';
import { Transaction } from './../../../../../functions/interfaces/models/transaction';
import { CacheService } from './../../../@core/services/cache/cache.service';

export const DEFAULT_SPACE: SelectBoxOption = {
  label: 'All spaces',
  value: 'all'
};

@Injectable()
export class DataService {
  public member$: BehaviorSubject<Member|undefined> = new BehaviorSubject<Member|undefined>(undefined);
  public awardsCompleted$: BehaviorSubject<Award[]|undefined> = new BehaviorSubject<Award[]|undefined>(undefined);
  public awardsPending$: BehaviorSubject<Award[]|undefined> = new BehaviorSubject<Award[]|undefined>(undefined);
  public badges$: BehaviorSubject<Transaction[]|undefined> = new BehaviorSubject<Transaction[]|undefined>(undefined);
  public space$: BehaviorSubject<Space[]|undefined> = new BehaviorSubject<Space[]|undefined>(undefined);

  constructor(private cache: CacheService) {
    // none.
  }

  public resetSubjects(): void {
    // Clean up all streams.
    this.member$.next(undefined);
    this.awardsCompleted$.next(undefined);
    this.awardsPending$.next(undefined);
    this.badges$.next(undefined);
    this.space$.next(undefined);
  }
}
