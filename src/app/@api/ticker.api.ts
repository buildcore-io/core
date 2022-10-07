import { Injectable } from "@angular/core";
import { Firestore } from "@angular/fire/firestore";
import { Functions } from "@angular/fire/functions";
import { COL } from "@functions/interfaces/models/base";
import { Ticker } from "@functions/interfaces/models/ticker";
import { BaseApi } from "./base.api";

@Injectable({
  providedIn: 'root',
})
export class TickerApi extends BaseApi<Ticker> {
  public collection = COL.TOKEN_MARKET;
  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }
}
