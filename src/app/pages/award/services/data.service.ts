import { Injectable } from '@angular/core';
import { AwardParticipantWithMember } from '@api/award.api';
import { Award, Space } from '@functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';
import { Member } from './../../../../../functions/interfaces/models/member';

@Injectable({
  providedIn: 'any',
})
export class DataService {
  public award$: BehaviorSubject<Award | undefined> = new BehaviorSubject<Award | undefined>(undefined);
  public space$: BehaviorSubject<Space | undefined> = new BehaviorSubject<Space | undefined>(undefined);
  public owners$: BehaviorSubject<Member[] | undefined> = new BehaviorSubject<Member[] | undefined>(undefined);
  public isLoggedInMemberWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public isParticipantWithinAward$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  public isLoading(arr: AwardParticipantWithMember[] | null | undefined): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: AwardParticipantWithMember[] | null | undefined): boolean {
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
