import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SortOptions } from './sort-options.interface';

// Needs to be implemented
@Injectable({
  providedIn: 'any',
})
export class FilterService {
  public selectedSort$: BehaviorSubject<SortOptions> = new BehaviorSubject<SortOptions>(
    SortOptions.RECENT,
  );
  public search$: BehaviorSubject<string | undefined> = new BehaviorSubject<string | undefined>(
    undefined,
  );

  // public static DEBOUNCE_TIME = GLOBAL_DEBOUNCE_TIME;
  public get sortOptions(): typeof SortOptions {
    return SortOptions;
  }

  public resetSubjects(): void {
    // We actually wanna keep it when they go back.
    // this.search$.next(undefined);
    // this.selectedSort$.next(SortOptions.RECENT);
    // this.selectedTags$.next(['All']);
  }
}
