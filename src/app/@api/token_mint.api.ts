import { Injectable } from "@angular/core";
import { AngularFirestore } from "@angular/fire/compat/firestore";
import { AngularFireFunctions } from "@angular/fire/compat/functions";
import { WEN_FUNC } from "@functions/interfaces/functions";
import { Transaction } from "@functions/interfaces/models";
import { COL, WenRequest } from "@functions/interfaces/models/base";
import { Token } from "@functions/interfaces/models/token";
import { Observable } from "rxjs";
import { BaseApi } from "./base.api";

@Injectable({
  providedIn: 'root',
})
export class TokenMintApi extends BaseApi<Token> {
  public collection = COL.TOKEN;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public mintToken(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.mintTokenOrder, req);
  }
}