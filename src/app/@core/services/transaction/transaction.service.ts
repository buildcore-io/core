import { Injectable } from '@angular/core';
import { Transaction, TransactionType } from '@functions/interfaces/models';

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

  public getExplorerLink(t: Transaction): string | null {
    const link = t.payload.chainReference || t.payload?.walletReference?.chainReference;
    if (!link) return null;
    return 'https://thetangle.org/search/' + link;
  }
}
