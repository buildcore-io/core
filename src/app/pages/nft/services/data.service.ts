import { Injectable } from "@angular/core";
import { Collection, Member, Space } from "functions/interfaces/models";
import { Nft } from "functions/interfaces/models/nft";
import { BehaviorSubject } from "rxjs";

@Injectable()
export class DataService {
  public nftId?: string;
  public nft$: BehaviorSubject<Nft|undefined> = new BehaviorSubject<Nft|undefined>(undefined);
  public collection$: BehaviorSubject<Collection|undefined> = new BehaviorSubject<Collection|undefined>(undefined);
  // TODO
  public topNftWithinCollection$: BehaviorSubject<Nft[]|undefined> = new BehaviorSubject<Nft[]|undefined>(undefined);
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public creator$: BehaviorSubject<Member|undefined> = new BehaviorSubject<Member|undefined>(undefined);
}
