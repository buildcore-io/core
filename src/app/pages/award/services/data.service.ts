import { Injectable } from '@angular/core';
import * as dayjs from 'dayjs';
import { Award, Space } from 'functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';
import { Member } from './../../../../../functions/interfaces/models/member';

@Injectable()
export class DataService {
  public award$: BehaviorSubject<Award|undefined> = new BehaviorSubject<Award|undefined>(undefined);
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public owners$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  public isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public isParticipantWithinAward$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  public isCompleted(award: Award|undefined|null): boolean {
    if (!award) {
      return false;
    }

    return (
      (award.issued >= award.badge.count) || dayjs(award?.endDate.toDate()).isBefore(dayjs()) &&
      award.approved
    )
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  public resetSubjects(): void {
    // Clean up all streams.
    this.award$.next(undefined);
    this.space$.next(undefined);
    this.owners$.next(undefined);
    this.isGuardianWithinSpace$.next(false);
    this.isParticipantWithinAward$.next(false);
  }
}
