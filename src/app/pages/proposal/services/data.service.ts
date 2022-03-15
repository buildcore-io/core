import { Injectable } from '@angular/core';
import { TIME_GAP_BETWEEN_MILESTONES } from '@functions/interfaces/config';
import { Proposal, Space, SpaceGuardian, Transaction } from '@functions/interfaces/models';
import * as dayjs from 'dayjs';
import { BehaviorSubject } from 'rxjs';
import { Award } from './../../../../../functions/interfaces/models/award';
import { Member } from './../../../../../functions/interfaces/models/member';
import { Milestone } from './../../../../../functions/interfaces/models/milestone';
import { ProposalAnswer, ProposalQuestion, ProposalSubType, ProposalType } from './../../../../../functions/interfaces/models/proposal';
import { TransactionWithFullMember } from './../../../@api/proposal.api';

@Injectable()
export class DataService {
  public proposal$: BehaviorSubject<Proposal|undefined> = new BehaviorSubject<Proposal|undefined>(undefined);
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public badges$: BehaviorSubject<Award[]|undefined> = new BehaviorSubject<Award[]|undefined>(undefined);
  public creator$: BehaviorSubject<Member|undefined> = new BehaviorSubject<Member|undefined>(undefined);
  public transactions$: BehaviorSubject<TransactionWithFullMember[]|undefined> = new BehaviorSubject<TransactionWithFullMember[]|undefined>(undefined);
  public currentMembersVotes$: BehaviorSubject<Transaction[]|undefined> = new BehaviorSubject<Transaction[]|undefined>(undefined);
  public canVote$: BehaviorSubject<boolean|undefined> = new BehaviorSubject<boolean|undefined>(false);
  public guardians$: BehaviorSubject<SpaceGuardian[]|undefined> = new BehaviorSubject<SpaceGuardian[]|undefined>(undefined);
  public lastMilestone$: BehaviorSubject<Milestone|undefined> = new BehaviorSubject<Milestone|undefined>(undefined);
  constructor() {
    // none.
  }

  public resetSubjects(): void {
    // Clean up all streams.
    this.proposal$.next(undefined);
    this.space$.next(undefined);
    this.badges$.next(undefined);
    this.creator$.next(undefined);
    this.transactions$.next(undefined);
    this.guardians$.next(undefined);
    this.lastMilestone$.next(undefined);
    this.canVote$.next(false);
  }

  public isMemberVote(type: ProposalType|undefined): boolean {
    return (type === ProposalType.MEMBERS);
  }

  public isNativeVote(type: ProposalType|undefined): boolean {
    return (type === ProposalType.NATIVE);
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  public isComplete(proposal?: Proposal|null): boolean {
    if (!proposal || this.isNativeVote(proposal.type)) {
      return false;
    }

    return (dayjs(proposal.settings.endDate.toDate()).isBefore(dayjs()) && !!proposal?.approved);
  }

  public isInProgress(proposal?: Proposal|null): boolean {
    if (!proposal || this.isNativeVote(proposal.type) || proposal.rejected) {
      return false;
    }

    return (!this.isComplete(proposal) && !this.isPending(proposal) && !!proposal.approved);
  }

  public isInProgressIgnoreStatus(proposal?: Proposal|null): boolean {
    if (!proposal || this.isNativeVote(proposal.type)) {
      return false;
    }

    return (!this.isComplete(proposal) && !this.isPending(proposal));
  }

  public isPending(proposal?: Proposal|null): boolean {
    if (!proposal || this.isNativeVote(proposal.type) || !proposal.approved) {
      return false;
    }

    return (dayjs(proposal.settings.startDate.toDate()).isAfter(dayjs()));
  }

  public getProgressWithTotalWeight(proposal: Proposal|null|undefined, a: ProposalAnswer): number {
    return  (proposal?.results?.answers?.[a.value] || 0) / (proposal?.results?.total || 1) * 100;
  }

  public getProgress(proposal: Proposal|null|undefined, a: ProposalAnswer): number {
    // if (proposal?.type === ProposalType.MEMBERS) {
    //   let total = 0;
    //   if (proposal?.results?.answers) {
    //     Object.keys(proposal?.results?.answers).forEach((b: any) => {
    //       total += proposal?.results?.answers[b] || 0;
    //     });
    //   }

    //   return  (proposal?.results?.answers?.[a.value] || 0) / (total) * 100;
    // } else {
    //   let total = 0;
    //   if ((<any>proposal?.results)?.questions?.[0].answers) {
    //     (<any>proposal?.results)?.questions?.[0].answers.forEach((b: any) => {
    //       if (b.value === 0 || b.value === 255) {
    //         return;
    //       }

    //       total += b.accumulated || 0;
    //     });
    //   }

    //   const ans: any = (<any>proposal?.results)?.questions?.[0].answers.find((suba: any) => {
    //     return suba.value === a.value;
    //   });

    //   return  (ans?.accumulated || 0) / (total) * 100;
    // }
    if (proposal?.type === ProposalType.NATIVE) {
      let total = 0;
      if ((<any>proposal?.results)?.questions?.[0].answers) {
        (<any>proposal?.results)?.questions?.[0].answers.forEach((b: any) => {
          if (b.value === 0 || b.value === 255) {
            return;
          }

          total += b.accumulated || 0;
        });
      }

      return total > 0 ? ((<any>a)?.accumulated || 0) / (total) * 100 : 0;
    } else {
      const answer = (proposal?.results?.answers?.[a.value] || 0) / (proposal?.results?.total || 1) * 100;
      return answer;
    }
  }

  public getVotingTypeText(subType: ProposalSubType|undefined): string {
    if (subType === ProposalSubType.ONE_ADDRESS_ONE_VOTE) {
      return 'IOTA Address Vote';
    } else if (subType === ProposalSubType.ONE_MEMBER_ONE_VOTE) {
      return 'One Member One Vote';
    } else if (subType === ProposalSubType.REPUTATION_BASED_ON_SPACE) {
      return 'XP Reputation - Space';
    } else if (subType === ProposalSubType.REPUTATION_BASED_ON_SPACE_WITH_ALLIANCE) {
      return 'XP Reputation - Space + Connection';
    } else if (subType === ProposalSubType.REPUTATION_BASED_ON_AWARDS) {
      return 'XP Reputation - Selected Badges';
    } else {
      return '';
    }
  }
  public getCommenceDate(proposal?: Proposal|null): Date|null {
    if (!proposal) {
      return null;
    }

    if (this.isNativeVote(proposal.type)) {
      return this.calcDateBasedOnMilestone(proposal, 'milestoneIndexCommence');
    } else {
      return proposal.createdOn?.toDate() || null;
    }
  }

  public getStartDate(proposal?: Proposal|null): Date|null {
    if (!proposal) {
      return null;
    }

    if (this.isNativeVote(proposal.type)) {
      return this.calcDateBasedOnMilestone(proposal, 'milestoneIndexStart');
    } else {
      return proposal.settings?.startDate?.toDate() || null;
    }
  }

  public getEndDate(proposal?: Proposal|null): Date|null {
    if (!proposal) {
      return null;
    }

    if (this.isNativeVote(proposal.type)) {
      return this.calcDateBasedOnMilestone(proposal, 'milestoneIndexEnd');
    } else {
      return proposal.settings?.endDate?.toDate() || null;
    }
  }

  private calcDateBasedOnMilestone(proposal: Proposal, f: 'milestoneIndexStart'|'milestoneIndexEnd'|'milestoneIndexCommence'): Date|null  {
    if (!this.lastMilestone$.value || !proposal.settings?.[f]) {
      return null;
    }

    // In seconds.
    const diff: number = (proposal.settings?.[f] - this.lastMilestone$.value.cmi) * TIME_GAP_BETWEEN_MILESTONES;
    return dayjs().add(diff, 'seconds').toDate();
  }

  public findAnswerText(qs: ProposalQuestion[]|undefined, values: number[]): string {
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
}
