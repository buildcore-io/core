import { Injectable } from "@angular/core";
import { Space } from "@functions/interfaces/models";
import { Token, TokenDistribution } from "@functions/interfaces/models/token";
import { BehaviorSubject } from "rxjs";

@Injectable({
  providedIn: 'any'
})
export class DataService {
  public token$: BehaviorSubject<Token | undefined> = new BehaviorSubject<Token | undefined>(undefined);
  public space$: BehaviorSubject<Space | undefined> = new BehaviorSubject<Space | undefined>(undefined);
  public distributions$: BehaviorSubject<TokenDistribution[] | undefined> = new BehaviorSubject<TokenDistribution[] | undefined>(undefined);
  public memberDistribution$?: BehaviorSubject<TokenDistribution | undefined> = new BehaviorSubject<TokenDistribution | undefined>(undefined);

  public resetSubjects(): void {
    // Clean up all streams.
    this.token$.next(undefined);
    this.space$.next(undefined);
    this.distributions$.next(undefined);
  }
}
