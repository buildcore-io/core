import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export enum SortOptions {
  RECENT = 'desc',
  OLDEST = 'asc'
}

@Injectable()
export class FilterService {
  public selectedSort$: BehaviorSubject<SortOptions> = new BehaviorSubject<SortOptions>(SortOptions.RECENT);
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>(['All']);
  public hotTags: string[] = ['All', 'Popular'];

  public handleChange(_checked: boolean, tag: string): void {
    this.selectedTags$.next([tag]);
  }

  public get sortOptions(): typeof SortOptions {
    return SortOptions;
  }
}
