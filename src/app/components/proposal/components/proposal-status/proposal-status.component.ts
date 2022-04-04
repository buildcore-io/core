import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as dayjs from 'dayjs';
import { BehaviorSubject, map, skip } from "rxjs";
import { Proposal, ProposalType } from '../../../../../../functions/interfaces/models/proposal';
import { Milestone } from './../../../../../../functions/interfaces/models/milestone';
import { MilestoneApi } from './../../../../@api/milestone.api';

@UntilDestroy()
@Component({
  selector: 'wen-proposal-status',
  templateUrl: './proposal-status.component.html',
  styleUrls: ['./proposal-status.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProposalStatusComponent implements OnInit {
  @Input() proposal?: Proposal|null;
  public lastMilestone$: BehaviorSubject<Milestone|undefined> = new BehaviorSubject<Milestone|undefined>(undefined);

  constructor(private milestoneApi: MilestoneApi, private cd: ChangeDetectorRef) {
    // none.
  }

  public ngOnInit(): void {
    this.milestoneApi.top(undefined, undefined, 1)?.pipe(untilDestroyed(this), map((o: Milestone[]) => {
      return o[0];
    })).subscribe(this.lastMilestone$);

    this.lastMilestone$.pipe(skip(1), untilDestroyed(this)).subscribe(() => {
      this.cd.markForCheck();
    });
  }

  public isNativeVote(type: ProposalType|undefined): boolean {
    return (type === ProposalType.NATIVE);
  }

  public isComplete(): boolean {
    if (!this.proposal || !this.lastMilestone$.value) {
      return false;
    }

    if (this.isNativeVote(this.proposal.type)) {
      return this.lastMilestone$.value?.cmi > this.proposal.settings.milestoneIndexEnd && !this.proposal.rejected;
    } else {
      return (dayjs(this.proposal.settings.endDate.toDate()).isBefore(dayjs()) && !this.proposal.rejected);
    }
  }

  public isInProgress(): boolean {
    if (!this.proposal || this.proposal.rejected || !this.lastMilestone$.value) {
      return false;
    }

    if (this.isNativeVote(this.proposal.type)) {
      return (
        this.lastMilestone$.value?.cmi < this.proposal.settings.milestoneIndexEnd &&
              this.lastMilestone$.value?.cmi > this.proposal.settings.milestoneIndexStart &&
              !this.proposal.rejected
      );
    } else {
      return (!this.isComplete() && !this.isCommencing() && !!this.proposal.approved);
    }
  }

  public isPending(): boolean {
    return (!this.isCommencing() && !this.isInProgress() && !this.isComplete() && !this.proposal?.rejected);
  }

  public isCommencing(): boolean {
    if (
      !this.proposal || !this.proposal.approved || this.proposal.rejected || !this.lastMilestone$.value) {
      return false;
    }

    if (this.isNativeVote(this.proposal.type)) {
      return (
        this.lastMilestone$.value?.cmi < this.proposal.settings.milestoneIndexStart &&
              this.lastMilestone$.value?.cmi > this.proposal.settings.milestoneIndexCommence &&
              !this.proposal.rejected
      );
    } else {
      return (dayjs(this.proposal.settings.startDate.toDate()).isAfter(dayjs()) && !this.isComplete());
    }
  }
}
