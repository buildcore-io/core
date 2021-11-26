import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import * as dayjs from 'dayjs';
import { Proposal, ProposalType } from '../../../../../../functions/interfaces/models/proposal';

@UntilDestroy()
@Component({
  selector: 'wen-proposal-status',
  templateUrl: './proposal-status.component.html',
  styleUrls: ['./proposal-status.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProposalStatusComponent {
  @Input() proposal?: Proposal|null;

  public isNativeVote(type: ProposalType|undefined): boolean {
    return (type === ProposalType.NATIVE);
  }

  public isComplete(): boolean {
    if (!this.proposal || this.isNativeVote(this.proposal.type)) {
      return false;
    }

    return (dayjs(this.proposal.settings.endDate.toDate()).isBefore(dayjs()) && !!this.proposal?.approved);
  }

  public isInProgress(): boolean {
    if (!this.proposal || this.isNativeVote(this.proposal.type)) {
      return false;
    }

    return (!this.isComplete() && !this.isPending() && !!this.proposal.approved);
  }

  public isPending(): boolean {
    if (!this.proposal || this.isNativeVote(this.proposal.type) || !this.proposal.approved) {
      return false;
    }

    return (dayjs(this.proposal.settings.startDate.toDate()).isAfter(dayjs()));
  }
}
