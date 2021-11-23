import { Injectable } from '@angular/core';
import { getItem, setItem, StorageItem } from '@core/utils';
import { undefinedToEmpty } from '@core/utils/manipulations.utils';
import detectEthereumProvider from '@metamask/detect-provider';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, firstValueFrom, skip, Subscription } from 'rxjs';
import { EthAddress, WenRequest } from '../../../../../functions/interfaces/models/base';
import { Member } from '../../../../../functions/interfaces/models/member';
import { METAMASK_CHAIN_ID, RPC_CHAIN } from './../../../../../functions/interfaces/config';
import { MemberApi } from './../../../@api/member.api';
import { removeItem } from './../../../@core/utils/local-storage.utils';

export interface MetamaskSignature {
  address: string;
  req: WenRequest;
}

export interface SignCallback {
  (sc: any, finish: any): void;
};

export enum WalletStatus {
  HIDDEN = 0,
  OPEN = 1,
  ACTIVE = 2,
  WRONG_CHAIN = 3
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  public isLoggedIn$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(!!getItem(StorageItem.Auth));
  public showWalletPopup$: BehaviorSubject<WalletStatus> = new BehaviorSubject<WalletStatus>(WalletStatus.HIDDEN);
  public member$: BehaviorSubject<Member|undefined> = new BehaviorSubject<Member|undefined>(undefined);
  private memberSubscription$?: Subscription;

  constructor(
    private memberApi: MemberApi,
    private notification: NzNotificationService
  ) {
    // Make sure member exists when we are logged in.
    this.member$.pipe(skip(1)).subscribe((m) => {
      if (!m && this.isLoggedIn$.value) {
        this.signOut();
      }
    });

    if (this.isLoggedIn$.value) {
      const address: EthAddress = <EthAddress>getItem(StorageItem.AuthAddress);
      if (!address) {
        // Missing address.
        setItem(StorageItem.Auth, false);
        this.isLoggedIn$.next(false);
      } else {
        this.monitorMember(<EthAddress>getItem(StorageItem.AuthAddress));
      }
    }
  }

  public openWallet(): void {
    this.showWalletPopup$.next(WalletStatus.OPEN);
  }

  public hideWallet(): void {
    this.showWalletPopup$.next(WalletStatus.HIDDEN);
  }

  get isLoggedIn(): boolean {
    return this.isLoggedIn$.getValue();
  }

  public async sign(params: any = {}, cb: SignCallback ): Promise<WenRequest|undefined> {
    const sc: WenRequest|undefined =  await this.signWithMetamask(undefinedToEmpty(params));
    if (!sc) {
      this.notification.error('Unable to sign transaction.', '');
      this.showWalletPopup$.next(WalletStatus.HIDDEN);
      return undefined;
    }

    // Callback function.
    cb(sc, () => {
      this.showWalletPopup$.next(WalletStatus.HIDDEN);
    });
    return sc;
  }

  private async signWithMetamask(params: any = {}): Promise<WenRequest|undefined> {
    this.showWalletPopup$.next(WalletStatus.ACTIVE);
    const provider: any = await detectEthereumProvider();
    if (provider) {
      try {

        try {
          // Make sure account is always selected.
          await provider.request({
            method: "eth_requestAccounts",
            params: [ { eth_accounts: {} } ]
          });
        } catch(e) {
          this.notification.error('You must enable access to read your account address.', '');
          this.showWalletPopup$.next(WalletStatus.HIDDEN);
          return undefined;
        }

        if (provider.chainId !== METAMASK_CHAIN_ID) {
          try {
            // Let's add new chain.
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [RPC_CHAIN],
            });

            // TODO Unable to detect if users decides to ADD network but not switch to IT
          } catch(e) {
            // If we fail we force user to do it manually.
            this.showWalletPopup$.next(WalletStatus.WRONG_CHAIN);
            return;
          }
        }

        if (!provider.selectedAddress) {
          this.notification.error('Please make sure you select address in MetaMask!', '');
          this.showWalletPopup$.next(WalletStatus.HIDDEN);
          return undefined;
        }

        const member: Member = await firstValueFrom(this.memberApi.createIfNotExists(provider.selectedAddress));
        const signature: string = await provider.request({
          method: 'personal_sign',
          params: [
            `0x${this.toHex(member.nonce!)}`,
            provider.selectedAddress,
          ],
        });

        return {
          address: provider.selectedAddress,
          signature: signature,
          body: params
        }
      } catch(e) {
        this.showWalletPopup$.next(WalletStatus.HIDDEN);
        return undefined;
      }
    } else {
      this.notification.error('Please install MetaMask wallet!', '');
      this.showWalletPopup$.next(WalletStatus.HIDDEN);
      return undefined;
    }
  }

  public monitorMember(address: EthAddress): void {
    this.memberSubscription$ = this.memberApi.listen(address).subscribe(this.member$);
  }

  public toHex(stringToConvert: string) {
    return stringToConvert.split('').map((c) => {
      return c.charCodeAt(0).toString(16).padStart(2, '0');
    }).join('');
  }

  public async signIn(): Promise<boolean> {
    const sc: WenRequest|undefined = await this.signWithMetamask({});
    if (!sc) {
      this.notification.error('Failed to log in.', '');
      return false;
    }

    this.showWalletPopup$.next(WalletStatus.HIDDEN);
    // Let's autheticate right the way with just UID.
    this.member$.next({
      uid: sc.address
    });
    this.isLoggedIn$.next(true);

    // Let's make sure we monitor the member.
    this.monitorMember(sc.address);

    // Store public ETH address in cookies.
    setItem(StorageItem.AuthAddress, sc.address);

    if (sc.address) {
      setItem(StorageItem.Auth, sc.address);
      this.isLoggedIn$.next(true);
    }

    return true;
  }

  signOut(): void {
    removeItem(StorageItem.Auth);
    this.memberSubscription$?.unsubscribe();
    this.isLoggedIn$.next(false);
    this.member$.next(undefined);
  }
}
