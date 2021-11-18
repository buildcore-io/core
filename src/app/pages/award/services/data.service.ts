import { Injectable } from '@angular/core';
import { Award } from 'functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';
import { Member } from './../../../../../functions/interfaces/models/member';

@Injectable()
export class DataService {
  public award$: BehaviorSubject<Award|undefined> = new BehaviorSubject<Award|undefined>(undefined);
  public owners$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  public participants$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  public isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  public isCompleted(award: Award|undefined|null): boolean {
    if (!award) {
      return false;
    }
    return (award.issued >= award.badge.count);
  }
}
