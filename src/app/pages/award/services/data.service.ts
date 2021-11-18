import { Injectable } from '@angular/core';
import { Award } from 'functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class DataService {
  public award$: BehaviorSubject<Award|undefined> = new BehaviorSubject<Award|undefined>(undefined);
}
