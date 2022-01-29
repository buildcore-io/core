import { Injectable } from '@angular/core';
import { Space } from "functions/interfaces/models";
import { BehaviorSubject, Subscription } from 'rxjs';
import { FULL_LIST } from './../../../@api/base.api';
import { SpaceApi } from './../../../@api/space.api';

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  public allSpaces$ = new BehaviorSubject<Space[]>([]);
  private subscriptions$: Subscription[] = [];
  constructor(
    private spaceApi: SpaceApi
  ) {
    // none.
  }

  public initCache(): void {
    this.subscriptions$.push(this.spaceApi.alphabetical(undefined, undefined, FULL_LIST).subscribe(this.allSpaces$));
  }

  public cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
