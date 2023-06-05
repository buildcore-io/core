import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { PublicCollections, Stake } from '@soonaverse/interfaces';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class StakeApi extends BaseApi<Stake> {
  constructor(protected httpClient: HttpClient) {
    super(PublicCollections.STAKE, httpClient);
  }
}
