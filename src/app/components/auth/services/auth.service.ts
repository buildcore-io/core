import { Injectable, NgZone } from '@angular/core';
import { GlobeIconComponent } from '@components/icon/globe/globe.component';
import { NftIconComponent } from '@components/icon/nft/nft.component';
import { PoolIconComponent } from '@components/icon/pool/pool.component';
import { RocketIconComponent } from '@components/icon/rocket/rocket.component';
import { SwapIconComponent } from '@components/icon/swap/swap.component';
import { TokenIconComponent } from '@components/icon/token/token.component';
import { UnamusedIconComponent } from '@components/icon/unamused/unamused.component';
import { getItem, setItem, StorageItem } from '@core/utils';
import { undefinedToEmpty } from '@core/utils/manipulations.utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import detectEthereumProvider from '@metamask/detect-provider';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, firstValueFrom, skip, Subscription } from 'rxjs';
import { EthAddress, WenRequest } from '../../../../../functions/interfaces/models/base';
import { Member } from '../../../../../functions/interfaces/models/member';
import { MemberApi } from './../../../@api/member.api';
import { removeItem } from './../../../@core/utils/local-storage.utils';

export interface MetamaskSignature {
  address: string;
  req: WenRequest;
}

export interface SignCallback {
  (sc: any, finish: any): void;
}

export interface MenuItem {
  route: string[];
  icon: any;
  title: string;
  authSepeator: boolean;
  unAuthauthSepeator: boolean;
}

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
  public member$: BehaviorSubject<Member | undefined> = new BehaviorSubject<Member | undefined>(undefined);
  public desktopMenuItems$: BehaviorSubject<MenuItem[]> = new BehaviorSubject<MenuItem[]>([]);
  public mobileMenuItems$: BehaviorSubject<MenuItem[]> = new BehaviorSubject<MenuItem[]>([]);
  private memberSubscription$?: Subscription;
  private discoverMenuItem: MenuItem = {
    route: [ROUTER_UTILS.config.discover.root],
    icon: RocketIconComponent,
    title: $localize`Discover`,
    authSepeator: true,
    unAuthauthSepeator: true,
  };
  private tokenMenuItem: MenuItem = {
    route: [ROUTER_UTILS.config.tokens.root],
    icon: TokenIconComponent,
    title: $localize`Tokens`,
    authSepeator: true,
    unAuthauthSepeator: false,
  };
  private swapMenuItem: MenuItem = {
    route: [ROUTER_UTILS.config.swap.root],
    icon: SwapIconComponent,
    title: $localize`Swap`,
    authSepeator: false,
    unAuthauthSepeator: false,
  };
  private poolMenuItem: MenuItem = {
    route: [ROUTER_UTILS.config.pool.root],
    icon: PoolIconComponent,
    title: $localize`Pool`,
    authSepeator: false,
    unAuthauthSepeator: false,
  };
  private marketMenuItem: MenuItem = {
    route: [ROUTER_UTILS.config.market.root],
    icon: NftIconComponent,
    title: $localize`Marketplace`,
    authSepeator: true,
    unAuthauthSepeator: true,
  };
  private overviewMenuItem: MenuItem = {
    route: [ROUTER_UTILS.config.base.dashboard],
    icon: GlobeIconComponent,
    title: $localize`My Overview`,
    authSepeator: false,
    unAuthauthSepeator: false,
  };

  constructor(
    private memberApi: MemberApi,
    private ngZone: NgZone,
    private notification: NzNotificationService,
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
        this.listenToAccountChange();
        this.monitorMember(<EthAddress>getItem(StorageItem.AuthAddress));
      }
    }

    // Add delay on initial load.
    setTimeout(() => {
      this.member$.subscribe((val) => {
        if (val) {
          this.setAuthMenu(val.uid);
        } else {
          this.setUnAuthMenu();
        }
      });

      this.isLoggedIn$.subscribe((val) => {
        if (!val) {
          this.setUnAuthMenu();
        }
      });
    }, 750);
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

  public async sign(params: any = {}, cb: SignCallback): Promise<WenRequest | undefined> {
    const sc: WenRequest | undefined | false = await this.signWithMetamask(undefinedToEmpty(params));
    if (!sc) {
      this.notification.error($localize`Unable to sign transaction. Please try to reload page.`, '');
      this.showWalletPopup$.next(WalletStatus.HIDDEN);
      return undefined;
    }

    // Callback function.
    cb(sc, () => {
      this.showWalletPopup$.next(WalletStatus.HIDDEN);
    });
    return sc;
  }

  public onMetaMaskAccountChange(accounts: string[]): void {
    if (accounts[0] !== this.member$.value?.uid) {
      this.signOut();
    }
  }

  public async stopMetamaskListeners(): Promise<void> {
    const provider: any = await detectEthereumProvider();
    if (provider) {
      provider.removeListener('accountsChanged', this.onMetaMaskAccountChange.bind(this));
    }
  }

  public async listenToAccountChange(): Promise<void> {
    const provider: any = await detectEthereumProvider();
    if (provider) {
      this.stopMetamaskListeners();
      provider.on('accountsChanged', this.onMetaMaskAccountChange.bind(this));
    }
  }

  public async mint(): Promise<boolean> {
    // TODO waiting for stable EVM to plug it into our SC.
    return true;
  }

  private async signWithMetamask(params: any = {}): Promise<WenRequest | undefined | false> {
    this.showWalletPopup$.next(WalletStatus.ACTIVE);
    const provider: any = await detectEthereumProvider();
    if (provider) {
      try {
        try {
          if (!(await provider._metamask.isUnlocked())) {
            this.notification.error($localize`You must unlock your MetaMask first!`, '');
            this.showWalletPopup$.next(WalletStatus.HIDDEN);
            return undefined;
          }

          // Make sure account is always selected.
          await provider.request({
            method: 'eth_requestAccounts',
            params: [{ eth_accounts: {} }],
          });
        } catch (e) {
          this.notification.error($localize`You must enable access to read your account address.`, '');
          this.showWalletPopup$.next(WalletStatus.HIDDEN);
          return undefined;
        }

        if (!provider.selectedAddress) {
          this.notification.error($localize`Please make sure you select address in MetaMask!`, '');
          this.showWalletPopup$.next(WalletStatus.HIDDEN);
          return undefined;
        }

        const member: Member | undefined = await firstValueFrom(this.memberApi.createIfNotExists(provider.selectedAddress));
        if (!member) {
          this.notification.error($localize`Unable to get nonce to authenticate!`, '');
          this.showWalletPopup$.next(WalletStatus.HIDDEN);
          return undefined;
        }

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
          body: params,
        };
      } catch (e) {
        this.showWalletPopup$.next(WalletStatus.HIDDEN);
        return undefined;
      }
    } else {
      this.showWalletPopup$.next(WalletStatus.HIDDEN);
      return false;
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
    const sc: WenRequest | undefined | false = await this.signWithMetamask({});
    if (!sc) {
      // Missing wallet.
      if (sc === false) {
        this.notification.success($localize`You have to open Soonaverse in MetaMask app.`, '');
      } else {
        this.notification.error($localize`Failed to initialize MetaMask, try to reload page.`, '');
      }
      return false;
    }

    this.showWalletPopup$.next(WalletStatus.HIDDEN);
    // Let's autheticate right the way with just UID.
    this.member$.next({
      uid: sc.address,
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

    // Listen to Metamask changes.
    this.listenToAccountChange();

    return true;
  }

  signOut(): void {
    // Sometimes it might be triggered outside i.e. via metamask.
    this.ngZone.run(() => {
      removeItem(StorageItem.Auth);
      this.memberSubscription$?.unsubscribe();
      this.isLoggedIn$.next(false);
      this.member$.next(undefined);
      this.stopMetamaskListeners();
    });
  }

  setAuthMenu(memberId: string): void {
    setTimeout(() => {
      this.desktopMenuItems$.next([
        this.overviewMenuItem,
        this.tokenMenuItem,
        this.swapMenuItem,
        this.poolMenuItem,
        this.marketMenuItem,
        this.discoverMenuItem,
        this.getMemberMenuItem(memberId),
      ]);

      this.mobileMenuItems$.next([
        this.overviewMenuItem,
        this.tokenMenuItem,
        this.swapMenuItem,
        this.poolMenuItem,
        this.marketMenuItem,
        this.discoverMenuItem,
        this.getMemberMenuItem(memberId),
      ]);
    }, 1000);
  }

  setUnAuthMenu(): void {
    this.desktopMenuItems$.next([
      this.tokenMenuItem,
      this.swapMenuItem,
      this.poolMenuItem,
      this.marketMenuItem,
      this.discoverMenuItem,
    ]);

    this.mobileMenuItems$.next([
      this.tokenMenuItem,
      this.swapMenuItem,
      this.poolMenuItem,
      this.marketMenuItem,
      this.discoverMenuItem,
    ]);
  }

  public getMemberMenuItem(memberId: string): MenuItem {
    return {
      route: [ROUTER_UTILS.config.member.root, memberId],
      icon: UnamusedIconComponent,
      title: $localize`My Profile`,
      authSepeator: false,
      unAuthauthSepeator: false,
    };
  }
}
