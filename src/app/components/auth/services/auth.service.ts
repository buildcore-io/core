import { Injectable } from '@angular/core';
import { getItem, removeItem, setItem, StorageItem } from '@core/utils';
import detectEthereumProvider from '@metamask/detect-provider';
import { BehaviorSubject, firstValueFrom, skip, Subscription } from 'rxjs';
import Web3 from 'web3';
import Web3Token from 'web3-token';
import { EthAddress } from '../../../../../functions/interfaces/models/base';
import { Member } from '../../../../../functions/interfaces/models/member';
import { DecodedToken } from './../../../../../functions/interfaces/functions/index';
import { MemberApi } from './../../../@api/member.api';

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

  async signWithMetamask(params: any = {}, expiresIn = '1m'): Promise<MetamaskSignature|undefined> {
    const provider: any = await detectEthereumProvider();
    if (provider) {
      try {
        // Connection to MetaMask wallet
        const web3: Web3 = new Web3(provider);
        await provider.enable();

        // Getting address from which we will sign message
        // TODO: allow user to select account.
        const address = (await web3.eth.getAccounts())[0];

        // generating a token with 1 day of expiration time
        const token = await Web3Token.sign((msg: any) => {
          return web3.eth.personal.sign(msg, address, 'pass');
        }, expiresIn, params);

        return {
          address: address,
          token: token
        };
      } catch(e) {
        // Ignore. they didn't log in.
        console.error(e);
        return undefined;
      }
    } else {
      console.log('Please install MetaMask!');
      return undefined;
    }
  }

  public monitorMember(address: EthAddress): void {
    this.memberSubscription$ = this.memberApi.listen(address).subscribe(this.member$);
  }

  public async signIn(): Promise<void> {
    const sc: MetamaskSignature|undefined = await this.signWithMetamask({}, '1d');
    if (!sc) {
      throw new Error('Unable to sign.');
    }

    // Let's autheticate right the way with just UID.
    this.member$.next({
      uid: sc.address
    });
    this.isLoggedIn$.next(true);

    // Make sure member is created if not exists yet.
    const m: Member|undefined = await firstValueFrom(this.memberApi.createIfNotExists(sc.token));
    if (!m) {
      throw new Error('Unable to create member!');
    }

    // Sent latest version.
    this.member$.next(m);

    // Let's make sure we monitor the member.
    this.monitorMember(sc.address);

    // Store public ETH address in cookies.
    setItem(StorageItem.AuthAddress, sc.address);

    if (sc.token) {
      setItem(StorageItem.Auth, sc.token);
      this.isLoggedIn$.next(true);
    }
  }

  public async decodeAuth(req: WenRequest): Promise<DecodedToken> {
    return await Web3Token.verify(token);
  }

  signOut(): void {
    removeItem(StorageItem.Auth);
    this.isLoggedIn$.next(false);
    this.memberSubscription$?.unsubscribe();
  }
}
