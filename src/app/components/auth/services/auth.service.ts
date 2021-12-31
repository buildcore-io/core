import { Injectable, NgZone } from '@angular/core';
import { GlobeIconComponent } from '@components/icon/globe/globe.component';
import { InfoIconComponent } from '@components/icon/info/info.component';
import { MarketIconComponent } from '@components/icon/market/market.component';
import { RocketIconComponent } from '@components/icon/rocket/rocket.component';
import { UnamusedIconComponent } from '@components/icon/unamused/unamused.component';
import { getItem, setItem, StorageItem } from '@core/utils';
import { undefinedToEmpty } from '@core/utils/manipulations.utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
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

export interface MenuItem {
  route: string[];
  icon: any;
  title: string;
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
  public member$: BehaviorSubject<Member|undefined> = new BehaviorSubject<Member|undefined>(undefined);
  public desktopMenuItems$: BehaviorSubject<MenuItem[]> = new BehaviorSubject<MenuItem[]>([]);
  public mobileMenuItems$: BehaviorSubject<MenuItem[]> = new BehaviorSubject<MenuItem[]>([]);
  private memberSubscription$?: Subscription;
  private defaultMenuItem1: MenuItem = { route: [ROUTER_UTILS.config.discover.root], icon: RocketIconComponent, title: 'Discover' };
  private defaultMenuItem2: MenuItem = { route: [ROUTER_UTILS.config.market.root], icon: MarketIconComponent, title: 'Marketplace' };
  // private defaultMenuItem3: MenuItem = { route: [ROUTER_UTILS.config.discover.root], icon: MarketIconComponent, title: 'Discover' };
  private dashboardMenuItem: MenuItem = { route: [ROUTER_UTILS.config.base.dashboard], icon: GlobeIconComponent, title: 'My Overview' };
  private aboutMenuItem: MenuItem = { route: [ROUTER_UTILS.config.about.root], icon: InfoIconComponent, title: 'About' };
  
  constructor(
    private memberApi: MemberApi,
    private ngZone: NgZone,
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
        this.listenToAccountChange();
        this.monitorMember(<EthAddress>getItem(StorageItem.AuthAddress));
      }
    }

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

  public async mint(_ipfsCid: string): Promise<boolean> {
    // TODO waiting for stable EVM to plug it into our SC.
    return true;
  }

  private async signWithMetamask(params: any = {}): Promise<WenRequest|undefined> {
    this.showWalletPopup$.next(WalletStatus.ACTIVE);
    const provider: any = await detectEthereumProvider();
    if (provider) {
      try {
        try {
          if (!(await provider._metamask.isUnlocked())) {
            this.notification.error('You must unlock your MetaMask first!', '');
            this.showWalletPopup$.next(WalletStatus.HIDDEN);
            return undefined;
          }

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

        const member: Member|undefined = await firstValueFrom(this.memberApi.createIfNotExists(provider.selectedAddress));
        if (!member) {
          this.notification.error('Unable to get nonce to authenticate!', '');
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
    this.desktopMenuItems$.next([
      this.defaultMenuItem1,
      this.defaultMenuItem2,
      this.dashboardMenuItem,
      this.getMemberMenuItem(memberId)
    ]);

    this.mobileMenuItems$.next([
      this.defaultMenuItem1,
      this.defaultMenuItem2,
      this.dashboardMenuItem,
      this.getMemberMenuItem(memberId)
      // this.aboutMenuItem
    ]);
  }

  setUnAuthMenu(): void {
    this.desktopMenuItems$.next([
      this.defaultMenuItem1,
      this.defaultMenuItem2
    ]);

    this.mobileMenuItems$.next([
      this.defaultMenuItem1,
      this.defaultMenuItem2,
      this.aboutMenuItem
    ]);
  }

  public getMemberMenuItem(memberId: string): MenuItem {
    return {
      route: [ROUTER_UTILS.config.member.root, memberId],
      icon: UnamusedIconComponent,
      title: 'My Profile'
    };
  }
}
