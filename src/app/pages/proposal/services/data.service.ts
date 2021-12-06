import { Injectable } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import * as dayjs from 'dayjs';
import { Proposal, Space, SpaceGuardian, Transaction } from 'functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';
import { Award } from './../../../../../functions/interfaces/models/award';
import { Member } from './../../../../../functions/interfaces/models/member';
import { ProposalAnswer, ProposalType } from './../../../../../functions/interfaces/models/proposal';
import { ProposalParticipantWithMember } from './../../../@api/proposal.api';

@Injectable()
export class DataService {
  public proposal$: BehaviorSubject<Proposal|undefined> = new BehaviorSubject<Proposal|undefined>(undefined);
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public badges$: BehaviorSubject<Award[]|undefined> = new BehaviorSubject<Award[]|undefined>(undefined);
  public creator$: BehaviorSubject<Member|undefined> = new BehaviorSubject<Member|undefined>(undefined);
  public members$: BehaviorSubject<ProposalParticipantWithMember[]|undefined> = new BehaviorSubject<ProposalParticipantWithMember[]|undefined>(undefined);
  public transactions$: BehaviorSubject<Transaction[]|undefined> = new BehaviorSubject<Transaction[]|undefined>(undefined);
  public currentMembersVotes$: BehaviorSubject<Transaction[]|undefined> = new BehaviorSubject<Transaction[]|undefined>(undefined);
  public canVote$: BehaviorSubject<boolean|undefined> = new BehaviorSubject<boolean|undefined>(false);
  public guardians$: BehaviorSubject<SpaceGuardian[]|undefined> = new BehaviorSubject<SpaceGuardian[]|undefined>(undefined);
  constructor(
    private auth: AuthService
  ) {
    // none.
  }

  public resetSubjects(): void {
    // Clean up all streams.
    this.proposal$.next(undefined);
    this.space$.next(undefined);
    this.creator$.next(undefined);
    this.members$.next(undefined);
    this.transactions$.next(undefined);
    this.guardians$.next(undefined);
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
    let total = 1;
    if (proposal?.results?.answers) {
      Object.keys(proposal?.results?.answers).forEach((a: any) => {
        total += a.value || 0;
      });
    }

    return  (proposal?.results?.answers?.[a.value] || 0) / (total) * 100;
  }

}
