import { Pipe, PipeTransform } from '@angular/core';
import { CacheService } from '@core/services/cache/cache.service';
import { NETWORK_DETAIL } from '@core/services/units';
import { Network } from '@soonaverse/interfaces';
import { lastValueFrom } from 'rxjs';

const DEF_DECIMALS = 6;
export interface ConvertValue {
  value: number | null | undefined;
  exponents: number | null | undefined; // DEFAULT TO SIX
}
@Pipe({
  name: 'formatToken',
})
export class FormatTokenPipe implements PipeTransform {
  public constructor(private cache: CacheService) {}
  public async transform(
    value: number | null | undefined | ConvertValue,
    tokenUidOrNetwork?: string | null,
    removeZeroes = false,
    showUnit = true,
    defDecimals = DEF_DECIMALS,
  ): Promise<string> {
    let network = Network.IOTA;
    if (typeof value === 'object') {
      if (value?.value) {
        value = this.multiValue(value);
      } else {
        value = 0;
      }
    }

    let tokenUid: string | undefined = undefined;
    if (tokenUidOrNetwork) {
      if (Object.keys(Network).includes(tokenUidOrNetwork)) {
        network = <Network>tokenUidOrNetwork;
      } else {
        tokenUid = tokenUidOrNetwork;
      }
    }

    if (tokenUid) {
      const token = await lastValueFrom(this.cache.getToken(tokenUid));
      if (!token) {
        // Unable to get token.
        return '-';
      }

      // We default to IOTA if it's not minted yet.
      network = token.mintingData?.networkFormat || token.mintingData?.network || Network.IOTA;
      if (defDecimals > token.decimals) {
        defDecimals = token.decimals;
      }
    }

    if (!value) {
      value = 0;
    }

    value = value / NETWORK_DETAIL[network].divideBy;

    const parts = (removeZeroes ? value : value.toFixed(defDecimals)).toString().split('.');
    const formattedValue =
      parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (parts.length === 2 ? '.' + parts[1] : '');
    return formattedValue + (showUnit ? ` ${NETWORK_DETAIL[network].label}` : '');
  }

  public multiValue(value: ConvertValue): number {
    if (value.exponents === 0) {
      return value.value!;
    } else {
      return Math.pow(value.value! * 10, value.exponents || 6);
    }
  }
}
