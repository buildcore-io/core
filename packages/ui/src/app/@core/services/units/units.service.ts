import { Injectable } from '@angular/core';
import { Network } from '@soonaverse/interfaces';
import { map, Observable } from 'rxjs';
import { CacheService } from '../cache/cache.service';

export const NETWORK_DETAIL = {
  [Network.IOTA]: {
    label: 'MIOTA',
    divideBy: 1000 * 1000,
  },
  [Network.ATOI]: {
    label: 'MATOI',
    divideBy: 1000 * 1000,
  },
  [Network.SMR]: {
    label: 'SMR',
    divideBy: 1000 * 1000,
  },
  [Network.RMS]: {
    label: 'RMS',
    divideBy: 1000 * 1000,
  },
};

export type Units = 'Pi' | 'Ti' | 'Gi' | 'Mi' | 'Ki' | 'i';

@Injectable({
  providedIn: 'root',
})
export class UnitsService {
  constructor(private cache: CacheService) {
    // noe.
  }

  public label(network?: Network | null): string {
    return NETWORK_DETAIL[network || Network.IOTA].label;
  }

  public getUsd(value: number | null | undefined, network?: Network | null): Observable<number> {
    if (!network) {
      network = Network.IOTA;
    }

    if (!value) {
      value = 0;
    }

    const mapPrice = (o: number) => {
      return o * value!;
    };

    if (network === Network.IOTA) {
      return this.cache.iotaUsdPrice$.pipe(map(mapPrice));
    } else {
      return this.cache.smrUsdPrice$.pipe(map(mapPrice));
    }
  }
}
