import { Injectable } from '@angular/core';
import { DEF_WALLET_PAY_IN_PROGRESS } from '@functions/interfaces/config';
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
    } else if (t.type === TransactionType.CREDIT_NFT) {
      return $localize`Credit NFT`;
    } else if (t.type === TransactionType.MINT_TOKEN) {
      return $localize`Mint Token`;
    } else if (t.type === TransactionType.MINT_COLLECTION) {
      return $localize`Mint Collection`;
    } else if (t.type === TransactionType.MINT_NFTS) {
      return $localize`Mint NFTs`;
    } else if (t.type === TransactionType.CHANGE_NFT_OWNER) {
      return $localize`Withdraw Asset`;
    } else {
      return $localize`Order`;
    }
  }

  public getExplorerLink(t?: Transaction): string | null {
    if (!t) return null;
    if (this.paymentNotProcessedOrInProgress(t)) return null;
    const link = t.payload.chainReference || t.payload?.walletReference?.chainReference;

    switch (t.network) {
    case Network.RMS:
    case Network.SMR:
      return 'https://explorer.shimmer.network/testnet/block/' + link;
    case Network.ATOI:
    case Network.IOTA:
    default:
      return 'https://thetangle.org/search/' + link;
    }
  }

  public paymentNotProcessedOrInProgress(tran: Transaction | undefined | null): boolean {
    return (!tran?.payload.chainReference && !tran?.payload.walletReference?.chainReference) || tran.payload.walletReference?.chainReference.startsWith(DEF_WALLET_PAY_IN_PROGRESS);
  }
}
