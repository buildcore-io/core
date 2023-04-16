import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { COL, Token, Transaction, WEN_FUNC, WenRequest } from '@soonaverse/interfaces';
import { Observable } from 'rxjs';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class TokenMintApi extends BaseApi<Token> {
  public collection = COL.TOKEN;

  constructor(protected firestore: Firestore, protected httpClient: HttpClient) {
    super(firestore, httpClient);
  }

  public mintToken(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.mintTokenOrder, req);
  }

  public importToken(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.importMintedToken, req);
  }
}
