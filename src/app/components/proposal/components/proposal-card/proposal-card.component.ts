import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import * as dayjs from 'dayjs';
import { Proposal } from '../../../../../../functions/interfaces/models/proposal';
import { ProposalAnswer, ProposalType } from './../../../../../../functions/interfaces/models/proposal';

@Component({
  selector: 'wen-proposal-card',
  templateUrl: './proposal-card.component.html',
  styleUrls: ['./proposal-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProposalCardComponent {
  @Input() proposal?: Proposal;
  @Input() fullWidth?: boolean;

  public getProgress(a: ProposalAnswer): number {
    return  (this.proposal?.results?.answers?.[a.value] || 0) / (this.proposal?.results?.total || 1) * 100;
  }

  public isNativeVote(type: ProposalType|undefined): boolean {
    return (type === ProposalType.NATIVE);
  }

  public isComplete(): boolean {
    if (!this.proposal || this.isNativeVote(this.proposal.type)) {
      return false;
    }

    return (dayjs(this.proposal.settings.endDate.toDate()).isBefore(dayjs()));
  }

  public isInProgress(): boolean {
    if (!this.proposal || this.isNativeVote(this.proposal.type)) {
      return false;
    }

    return (!this.isComplete() && !this.isPending());
  }

  public isPending(): boolean {
    if (!this.proposal || this.isNativeVote(this.proposal.type)) {
      return false;
    }

    return (dayjs(this.proposal.settings.startDate.toDate()).isAfter(dayjs()));
  }
}
