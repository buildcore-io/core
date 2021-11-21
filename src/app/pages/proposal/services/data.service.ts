import { Injectable } from '@angular/core';
import { Proposal, Space, SpaceGuardian, Transaction } from 'functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';
import { ProposalMember } from './../../../../../functions/interfaces/models/proposal';

@Injectable()
export class DataService {
  public proposal$: BehaviorSubject<Proposal|undefined> = new BehaviorSubject<Proposal|undefined>(undefined);
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public members$: BehaviorSubject<ProposalMember[]|undefined> = new BehaviorSubject<ProposalMember[]|undefined>(undefined);
  public transactions$: BehaviorSubject<Transaction[]|undefined> = new BehaviorSubject<Transaction[]|undefined>(undefined);
  public guardians$: BehaviorSubject<SpaceGuardian[]|undefined> = new BehaviorSubject<SpaceGuardian[]|undefined>(undefined);
}
