import { Injectable } from "@angular/core";
import { AngularFirestore } from "@angular/fire/compat/firestore";
import { AngularFireFunctions } from "@angular/fire/compat/functions";
import { WEN_FUNC } from "@functions/interfaces/functions";
import { Collection, Transaction } from "@functions/interfaces/models";
import { COL, WenRequest } from "@functions/interfaces/models/base";
import { Observable } from "rxjs";
import { BaseApi } from "./base.api";

@Injectable({
  providedIn: 'root',
})
export class CollectionMintApi extends BaseApi<Collection> {
  public collection = COL.COLLECTION;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public mintCollection(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.mintCollection, req);
  }
}