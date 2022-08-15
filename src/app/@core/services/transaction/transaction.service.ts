import { Injectable } from '@angular/core';
import { Network, Transaction, TransactionType } from '@functions/interfaces/models';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  public getTitle(t: Transaction): string {
    if (t.type === TransactionType.BILL_PAYMENT) {
      if (t.payload.royalty === false) {
        return $localize`Bill (owner)`;
      } else {
        return $localize`Bill (royalty)`;
      }
    } else if (t.type === TransactionType.CREDIT) {
      return $localize`Credit`;
    } else if (t.type === TransactionType.PAYMENT) {
      return $localize`Payment`;
    } else {
      return $localize`Order`;
    }
  }

  public getExplorerLink(t?: Transaction): string | null {
    if (!t) return null;
    
    const link = t.payload.chainReference || t.payload?.walletReference?.chainReference;
    
    if (!link) return null;

    switch (t.sourceNetwork) {
    case Network.RMS:
    case Network.SMR:
      return 'https://explorer.shimmer.network/testnet/block/' + link;
    case Network.ATOI:
    case Network.IOTA:
    default:
      return 'https://thetangle.org/search/' + link;
    }
  }
}
