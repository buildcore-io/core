import { Injectable } from '@angular/core';
import { UnitsService } from '@core/services/units';
import {
  Proposal,
  ProposalQuestion,
  ProposalSubType,
  ProposalType,
  PROPOSAL_COMMENCING_IN_DAYS,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';

@Injectable({
  providedIn: 'root',
})
export class HelperService {
  constructor(public unitsService: UnitsService) {}

  public getVotingTypeText(
    subType: ProposalSubType | undefined,
    type: ProposalType | undefined,
  ): string {
    if (subType === ProposalSubType.ONE_MEMBER_ONE_VOTE && type === ProposalType.NATIVE) {
      return $localize`Space's Native Token`;
    } else if (subType === ProposalSubType.ONE_MEMBER_ONE_VOTE) {
      return $localize`One Member One Vote`;
    } else if (subType === ProposalSubType.REPUTATION_BASED_ON_SPACE) {
      return $localize`XP Reputation - Space`;
    } else if (subType === ProposalSubType.REPUTATION_BASED_ON_AWARDS) {
      return $localize`XP Reputation - Selected Badges`;
    } else {
      return '';
    }
  }

  public getCommenceDate(proposal?: Proposal | null): Date | null {
    if (!proposal) {
      return null;
    }

    return proposal.settings?.startDate?.toDate()
      ? dayjs(proposal.settings?.startDate?.toDate()).subtract(1, 'day').toDate()
      : null;
  }

  public getStartDate(proposal?: Proposal | null): Date | null {
    if (!proposal) {
      return null;
    }

    return proposal.settings?.startDate?.toDate() || null;
  }

  public getEndDate(proposal?: Proposal | null): Date | null {
    if (!proposal) {
      return null;
    }

    return proposal.settings?.endDate?.toDate() || null;
  }

  public findAnswerText(qs: ProposalQuestion[] | undefined, values: number[]): string {
    let text = '';
    qs?.forEach((q: ProposalQuestion) => {
      q.answers.forEach((a) => {
        if (values.includes(a.value)) {
          text = a.text;
        }
      });
    });

    return text;
  }

  public isComplete(proposal?: Proposal | null): boolean {
    if (!proposal) {
      return false;
    }

    return dayjs(proposal.settings.endDate.toDate()).isBefore(dayjs()) && !!proposal?.approved;
  }

  public isInProgress(proposal?: Proposal | null): boolean {
    if (!proposal || proposal.rejected) {
      return false;
    }

    return !this.isComplete(proposal) && !this.isPending(proposal) && !!proposal.approved;
  }

  public isInProgressIgnoreStatus(proposal?: Proposal | null): boolean {
    if (!proposal) {
      return false;
    }

    return !this.isComplete(proposal) && !this.isPending(proposal);
  }

  public isPending(proposal?: Proposal | null): boolean {
    if (!proposal || !proposal.approved) {
      return false;
    }

    return dayjs(proposal.settings.startDate.toDate()).isAfter(dayjs());
  }

  public isCommencing(proposal?: Proposal | null): boolean {
    if (!proposal || !proposal.approved || proposal.rejected) {
      return false;
    }

    return (
      dayjs(proposal.settings.startDate.toDate())
        .subtract(PROPOSAL_COMMENCING_IN_DAYS, 'd')
        .isBefore(dayjs()) &&
      dayjs(proposal.settings.startDate.toDate()).isAfter(dayjs()) &&
      !this.isComplete()
    );
  }

  public isNativeVote(type: ProposalType | undefined): boolean {
    return type === ProposalType.NATIVE;
  }

  public formatBest(proposal: Proposal | null | undefined, value: number): string {
    if (!proposal) {
      return '';
    }

    const ans: any = (<Proposal>proposal?.results)?.questions?.[0].answers.find((suba: any) => {
      return suba.value === value;
    });
    if (!ans) {
      return '';
    }

    return this.unitsService.format(ans.accumulated);
  }

  public getShareUrl(proposal?: Proposal | null): string {
    return proposal?.wenUrl || window?.location.href;
  }
}
