import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject } from 'rxjs';
import { Proposal } from './../../../../../../functions/interfaces/models/proposal';
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
    this.proposalApi.last().pipe(untilDestroyed(this)).subscribe(this.proposal$);
  }
}
