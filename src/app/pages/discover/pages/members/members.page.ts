import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, map } from 'rxjs';
import { Member } from './../../../../../../functions/interfaces/models/member';
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { MemberApi } from './../../../../@api/member.api';

@UntilDestroy()
@Component({
  templateUrl: './members.page.html',
  styleUrls: ['./members.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersPage implements OnInit {
  public members$: BehaviorSubject<Member[]> = new BehaviorSubject<Member[]>([]);
  constructor(private memberApi: MemberApi) {
    // none.
  }

  public ngOnInit(): void {
    this.memberApi.lastByRank().pipe(untilDestroyed(this)).subscribe(this.members$);
  }

  public onScroll(): void {
    this.memberApi.lastByRank(this.members$.value[this.members$.value.length - 1].createdOn).pipe(
      untilDestroyed(this),
      map((a) => {
        return [...(this.members$.value || []), ...a];
      })
    ).subscribe(this.members$);
  }

  public get maxRecords(): number {
    return DEFAULT_LIST_SIZE;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
