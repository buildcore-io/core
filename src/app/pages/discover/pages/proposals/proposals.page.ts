import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, map } from 'rxjs';
import { Proposal } from './../../../../../../functions/interfaces/models/proposal';
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { ProposalApi } from './../../../../@api/proposal.api';

@UntilDestroy()
@Component({
  templateUrl: './proposals.page.html',
  styleUrls: ['./proposals.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class ProposalsPage {
  public proposal$: BehaviorSubject<Proposal[]> = new BehaviorSubject<Proposal[]>([]);
  constructor(private proposalApi: ProposalApi) {
    // none.
  }

  public ngOnInit(): void {
    this.proposalApi.lastByRank().pipe(untilDestroyed(this)).subscribe(this.proposal$);
  }

  public onScroll(): void {
    this.proposalApi.lastByRank(this.proposal$.value[this.proposal$.value.length - 1].createdOn).pipe(
      untilDestroyed(this),
      map((a) => {
        return [...(this.proposal$.value || []), ...a];
      })
    ).subscribe(this.proposal$);
  }

  public get maxRecords(): number {
    return DEFAULT_LIST_SIZE;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
