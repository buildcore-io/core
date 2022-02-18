import { Injectable } from "@angular/core";
import { SuccesfullOrdersWithFullHistory } from "@api/nft.api";
import { UnitsHelper } from "@core/utils/units-helper";
import { Collection, Member, Space } from "functions/interfaces/models";
import { Nft } from "functions/interfaces/models/nft";
import { BehaviorSubject } from "rxjs";

@Injectable()
export class DataService {
  public nftId?: string;
  public nft$: BehaviorSubject<Nft|undefined> = new BehaviorSubject<Nft|undefined>(undefined);
  public collection$: BehaviorSubject<Collection|undefined> = new BehaviorSubject<Collection|undefined>(undefined);
  public topNftWithinCollection$: BehaviorSubject<Nft[]|undefined> = new BehaviorSubject<Nft[]|undefined>(undefined);
  public orders$: BehaviorSubject<SuccesfullOrdersWithFullHistory[]|undefined> = new BehaviorSubject<SuccesfullOrdersWithFullHistory[]|undefined>(undefined);
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public royaltySpace$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public creator$: BehaviorSubject<Member|undefined> = new BehaviorSubject<Member|undefined>(undefined);
  public collectionCreator$: BehaviorSubject<Member|undefined> = new BehaviorSubject<Member|undefined>(undefined);

  public getPropStats(obj: any): any[] {
    if (!obj) {
      return [];
    }

    const final: any[] = [];
    for (const v of Object.values(obj)) {
      final.push(v);
    }

    return final;
  }

  public formatBest(amount?: number|null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
  }
}
