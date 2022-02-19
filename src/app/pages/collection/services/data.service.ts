import { Injectable } from "@angular/core";
import { Collection, Member, Space } from "functions/interfaces/models";
import { Nft } from "functions/interfaces/models/nft";
import { BehaviorSubject } from "rxjs";

@Injectable()
export class DataService {
  public collectionId?: string;
  public collection$: BehaviorSubject<Collection|undefined> = new BehaviorSubject<Collection|undefined>(undefined);
  public cheapestNft$: BehaviorSubject<Nft|undefined> = new BehaviorSubject<Nft|undefined>(undefined);
  public firstNft$: BehaviorSubject<Nft|undefined> = new BehaviorSubject<Nft|undefined>(undefined);
  public nft$: BehaviorSubject<Nft[]|undefined> = new BehaviorSubject<Nft[]|undefined>(undefined);
  public isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public creator$: BehaviorSubject<Member|undefined> = new BehaviorSubject<Member|undefined>(undefined);
  public dataStore: Nft[][] = [];
  public isPending(collection?: Collection|null): boolean {
    return collection?.approved !== true && collection?.rejected !== true;
  }
}
