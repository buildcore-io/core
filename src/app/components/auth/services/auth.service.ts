import { Injectable } from '@angular/core';
import { getItem, setItem, StorageItem } from '@core/utils';
import { undefinedToEmpty } from '@core/utils/manipulations.utils';
import detectEthereumProvider from '@metamask/detect-provider';
import { BehaviorSubject, firstValueFrom, skip, Subscription } from 'rxjs';
import { EthAddress, WenRequest } from '../../../../../functions/interfaces/models/base';
import { Member } from '../../../../../functions/interfaces/models/member';
import { MemberApi } from './../../../@api/member.api';
import { removeItem } from './../../../@core/utils/local-storage.utils';

export interface MetamaskSignature {
  address: string;
  req: WenRequest;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  public isLoggedIn$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(!!getItem(StorageItem.Auth));
  public member$: BehaviorSubject<Member|undefined> = new BehaviorSubject<Member|undefined>(undefined);
  private memberSubscription$?: Subscription;

  constructor(private memberApi: MemberApi) {
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

  get isLoggedIn(): boolean {
    return this.isLoggedIn$.getValue();
  }

  public async sign(params: any = {}): Promise<WenRequest> {
    const sc: WenRequest|undefined =  await this.signWithMetamask(undefinedToEmpty(params));
    if (!sc) {
      throw new Error('Unable to sign.');
    }

    return sc;
  }

  private async signWithMetamask(params: any = {}): Promise<WenRequest|undefined> {
    const provider: any = await detectEthereumProvider();
    if (provider) {
      await provider.request({ method: 'eth_requestAccounts' });
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
    } else {
      console.log('Please install MetaMask!');
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

  public async signIn(): Promise<void> {
    const sc: WenRequest|undefined = await this.signWithMetamask({});
    if (!sc) {
      throw new Error('Unable to sign.');
    }

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
  }

  signOut(): void {
    removeItem(StorageItem.Auth);
    this.memberSubscription$?.unsubscribe();
    this.isLoggedIn$.next(false);
    this.member$.next(undefined);
  }
}
