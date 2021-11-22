import { Injectable } from '@angular/core';
import { Award, Space } from 'functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';
import { Member } from './../../../../../functions/interfaces/models/member';
import { Proposal } from './../../../../../functions/interfaces/models/proposal';
import { AuthService } from './../../../components/auth/services/auth.service';

@Injectable()
export class DataService {
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public isMemberWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public guardians$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  public proposalsActive$: BehaviorSubject<Proposal[]|undefined> = new BehaviorSubject<Proposal[]|undefined>(undefined);
  public proposalsCompleted$: BehaviorSubject<Proposal[]|undefined> = new BehaviorSubject<Proposal[]|undefined>(undefined);
  public awardsActive$: BehaviorSubject<Award[]|undefined> = new BehaviorSubject<Award[]|undefined>(undefined);
  public awardsCompleted$: BehaviorSubject<Award[]|undefined> = new BehaviorSubject<Award[]|undefined>(undefined);
  public members$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  public blockedMembers$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  public pendingMembers$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);

  constructor(private auth: AuthService) {
    // none.
  }

  public loggedInMemberIsGuardian(): boolean {
    if (!this.guardians$.value) {
      return false;
    }

    const currentMemberId: string | undefined = this.auth.member$?.value?.uid;
    if (!currentMemberId) {
      return false;
    }

    return this.guardians$.value.filter(e => e.uid === currentMemberId).length > 0;
  }

  public getPendingMembersCount(members?: Member[]|null): number {
    if (!members || !this.isGuardianWithinSpace$.value) {
      return 0;
    }

    return members.length;
  }
}
