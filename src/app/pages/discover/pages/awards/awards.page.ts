import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, map } from 'rxjs';
import { Award } from './../../../../../../functions/interfaces/models/award';
import { AwardApi } from './../../../../@api/award.api';

@UntilDestroy()
@Component({
  templateUrl: './awards.page.html',
  styleUrls: ['./awards.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class AwardsPage implements OnInit {
  public award$: BehaviorSubject<Award[]> = new BehaviorSubject<Award[]>([]);
  constructor(private awardApi: AwardApi) {
    // none.
  }

  public ngOnInit(): void {
    this.awardApi.lastByRank().pipe(untilDestroyed(this)).subscribe(this.award$);
  }

  public onScroll(): void {
    this.awardApi.lastByRank(this.award$.value[this.award$.value.length - 1].createdOn).pipe(
      untilDestroyed(this),
      map((a) => {
        return [...(this.award$.value || []), ...a];
      })
    ).subscribe(this.award$);
  }

  public get maxRecords(): number {
    return DEFAULT_LIST_SIZE;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
