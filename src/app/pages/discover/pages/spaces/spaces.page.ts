import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Space } from "functions/interfaces/models";
import { BehaviorSubject, map } from 'rxjs';
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { SpaceApi } from './../../../../@api/space.api';

@UntilDestroy()
@Component({
  templateUrl: './spaces.page.html',
  styleUrls: ['./spaces.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpacesPage implements OnInit {
  public spaces$: BehaviorSubject<Space[]> = new BehaviorSubject<Space[]>([]);
  constructor(private spaceApi: SpaceApi) {
    // none.
  }

  public ngOnInit(): void {
    this.spaceApi.lastByRank().pipe(untilDestroyed(this)).subscribe(this.spaces$);
  }

  public onScroll(): void {
    this.spaceApi.lastByRank(this.spaces$.value[this.spaces$.value.length - 1].createdOn).pipe(
      untilDestroyed(this),
      map((a) => {
        return [...(this.spaces$.value || []), ...a];
      })
    ).subscribe(this.spaces$);
  }

  public get maxRecords(): number {
    return DEFAULT_LIST_SIZE;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
