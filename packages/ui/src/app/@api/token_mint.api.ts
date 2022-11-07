import { Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { COL, Token, Transaction, WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
import { Observable } from 'rxjs';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class TokenMintApi extends BaseApi<Token> {
  public collection = COL.TOKEN;

  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }

  public mintToken(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.mintTokenOrder, req);
  }
}