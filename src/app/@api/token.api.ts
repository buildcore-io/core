import { Injectable } from "@angular/core";
import { AngularFirestore } from "@angular/fire/compat/firestore";
import { AngularFireFunctions } from "@angular/fire/compat/functions";
import { WEN_FUNC } from "@functions/interfaces/functions";
import { COL, WenRequest } from "@functions/interfaces/models/base";
import { Token } from "@functions/interfaces/models/token";
import { Observable } from "rxjs";
import { BaseApi, DEFAULT_LIST_SIZE } from "./base.api";

@Injectable({
  providedIn: 'root',
})
export class TokenApi extends BaseApi<Token> {
  public token = COL.TOKEN;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public create(req: WenRequest): Observable<Token | undefined> {
    return this.request(WEN_FUNC.cToken, req);
  }

  public lowToHigh(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query(this.token, 'pricePerToken', 'asc', lastValue, search, def);
  }

  public lowToHighSpace(space: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query(this.token, 'pricePerToken', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('space', '==', space);
    });
  }

  public lowToHighStatus(status: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('status', '==', status);
    });
  }

  public top(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query(this.token, 'createdOn', 'desc', lastValue, search, def);
  }

  public topSpace(space: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query(this.token, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('space', '==', space);
    });
  }

  public topStatus(status: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('status', '==', status);
    });
  }

  public highToLow(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query(this.token, 'pricePerToken', 'desc', lastValue, search, def);
  }

  public highToLowSpace(space: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query(this.token, 'pricePerToken', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('space', '==', space);
    });
  }

  public highToLowStatus(status: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query(this.token, 'pricePerToken', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('status', '==', status);
    });
  }

  public space(space: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query(this.token, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('space', '==', space);
    });
  }

  public topMember(member: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query(this.token, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('owner', '==', member);
    });
  }
}
