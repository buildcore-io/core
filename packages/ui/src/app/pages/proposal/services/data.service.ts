import { Injectable } from '@angular/core';
import {
  Award,
  Member,
  Milestone,
  Proposal,
  ProposalAnswer,
  ProposalType,
  Space,
  SpaceGuardian,
  Transaction,
} from '@soonaverse/interfaces';
import { BehaviorSubject } from 'rxjs';
import { TransactionWithFullMember } from './../../../@api/proposal.api';

@Injectable({
  providedIn: 'any',
})
export class DataService {
  public proposal$: BehaviorSubject<Proposal | undefined> = new BehaviorSubject<
    Proposal | undefined
  >(undefined);
  public space$: BehaviorSubject<Space | undefined> = new BehaviorSubject<Space | undefined>(
    undefined,
  );
  public badges$: BehaviorSubject<Award[] | undefined> = new BehaviorSubject<Award[] | undefined>(
    undefined,
  );
  public creator$: BehaviorSubject<Member | undefined> = new BehaviorSubject<Member | undefined>(
    undefined,
  );
  public transactions$: BehaviorSubject<TransactionWithFullMember[] | undefined> =
    new BehaviorSubject<TransactionWithFullMember[] | undefined>(undefined);
  public currentMembersVotes$: BehaviorSubject<Transaction[] | undefined> = new BehaviorSubject<
    Transaction[] | undefined
  >(undefined);
  public canVote$: BehaviorSubject<boolean | undefined> = new BehaviorSubject<boolean | undefined>(
    false,
  );
  public guardians$: BehaviorSubject<SpaceGuardian[] | undefined> = new BehaviorSubject<
    SpaceGuardian[] | undefined
  >(undefined);
  public lastMilestone$: BehaviorSubject<Milestone | undefined> = new BehaviorSubject<
    Milestone | undefined
  >(undefined);

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

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return Array.isArray(arr) && arr.length === 0;
  }

  public getProgress(proposal: Proposal | null | undefined, a: ProposalAnswer): number {
    if (proposal?.type !== ProposalType.NATIVE) {
      let total = 0;
      if (proposal?.results?.answers) {
        Object.keys(proposal?.results?.answers).forEach((b: any) => {
          total += proposal?.results?.answers[b] || 0;
        });
      }

      return ((proposal?.results?.answers?.[a.value] || 0) / total) * 100;
    } else {
      let total = 0;
      if ((<Proposal>proposal?.results)?.questions?.[0].answers) {
        (<Proposal>proposal?.results)?.questions?.[0].answers.forEach((b: any) => {
          if (b.value === 0 || b.value === 255) {
            return;
          }

          total += b.accumulated || 0;
        });
      }

      const ans: any = (<Proposal>proposal?.results)?.questions?.[0].answers.find((suba: any) => {
        return suba.value === a.value;
      });

      return ((ans?.accumulated || 0) / total) * 100;
    }
  }
}
