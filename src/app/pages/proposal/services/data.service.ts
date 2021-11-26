import { Injectable } from '@angular/core';
import { Proposal, Space, SpaceGuardian, Transaction } from 'functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';
import { Member } from './../../../../../functions/interfaces/models/member';
import { ProposalParticipantWithMember } from './../../../@api/proposal.api';

@Injectable()
export class DataService {
  public proposal$: BehaviorSubject<Proposal|undefined> = new BehaviorSubject<Proposal|undefined>(undefined);
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public creator$: BehaviorSubject<Member|undefined> = new BehaviorSubject<Member|undefined>(undefined);
  public members$: BehaviorSubject<ProposalParticipantWithMember[]|undefined> = new BehaviorSubject<ProposalParticipantWithMember[]|undefined>(undefined);
  public transactions$: BehaviorSubject<Transaction[]|undefined> = new BehaviorSubject<Transaction[]|undefined>(undefined);
  public guardians$: BehaviorSubject<SpaceGuardian[]|undefined> = new BehaviorSubject<SpaceGuardian[]|undefined>(undefined);
  public resetSubjects(): void {
    // Clean up all streams.
    this.proposal$.next(undefined);
    this.space$.next(undefined);
    this.creator$.next(undefined);
    this.members$.next(undefined);
    this.transactions$.next(undefined);
    this.guardians$.next(undefined);
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }
}
