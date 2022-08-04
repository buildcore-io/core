import { Injectable } from '@angular/core';
import { Network } from '@functions/interfaces/models';

export const NETWORK_LABEL = {
  [Network.IOTA]: {
    label: 'MIOTA',
    divideBy: 1000 * 1000
  },
  [Network.ATOI]: {
    label: 'MATOI',
    divideBy: 1000 * 1000
  },
  [Network.SMR]: {
    label: 'SMR',
    divideBy: 1000 * 1000
  },
  [Network.RMS]: {
    label: 'RMS',
    divideBy: 1000 * 1000
  }
}

export type Units = "Pi" | "Ti" | "Gi" | "Mi" | "Ki" | "i";

@Injectable({
  providedIn: 'root'
})
export class UnitsService {
  public label(network: Network): string {
    return NETWORK_LABEL[network].label;
  }

  public format(value: number | null | undefined, network?: Network|null, removeZeroes = false, showUnit = true): string {
    if (!network) {
      network = Network.IOTA;
    }

    if (!value) {
      value = 0;
    }

    value = value / NETWORK_LABEL[network].divideBy;
    
    const parts = (removeZeroes ? value : value.toFixed(6)).toString().split('.');
    const formattedValue = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (parts.length === 2 ? '.' + parts[1] : '');

    return formattedValue + (showUnit ? ` ${NETWORK_LABEL[network].label}` : '');
  }
}
