import { Injectable } from '@angular/core';
import { getItem, removeItem, setItem, StorageItem } from '@core/utils';
import detectEthereumProvider from '@metamask/detect-provider';
import { BehaviorSubject, firstValueFrom, Subscription } from 'rxjs';
import Web3 from 'web3';
import Web3Token from 'web3-token';
import { EthAddress } from '../../../../../functions/interfaces/models/base';
import { Member } from '../../../../../functions/interfaces/models/member';
import { MemberApi } from './../../../@api/member.api';

export interface DecodedToken {
  address: string;
  body: any;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  isLoggedIn$ = new BehaviorSubject<boolean>(!!getItem(StorageItem.Auth));
  member$ = new BehaviorSubject<Member|undefined>(undefined);
  private memberSubscription$?: Subscription;

  constructor(private memberApi: MemberApi) {
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

  async signWithMetamask(params: any = {}, expiresIn = '15s'): Promise<string|undefined> {
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

        // Make sure member is created if not exists yet.
        this.member$.next(await firstValueFrom(this.memberApi.createIfNotExists(address)));

        // Let's make sure we monitor the member.
        this.monitorMember(address);

        // Store public ETH address in cookies.
        setItem(StorageItem.AuthAddress, address);

        return token;
      } catch(e) {
        // Ignore. they didn't log in.
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
    const token: string|undefined = await this.signWithMetamask({}, '1d');
    if (token) {
      setItem(StorageItem.Auth, token);
      this.isLoggedIn$.next(true);
    }
  }

  public async decodeToken(token: string): Promise<DecodedToken> {
    return await Web3Token.verify(token);
  }

  signOut(): void {
    removeItem(StorageItem.Auth);
    this.isLoggedIn$.next(false);
    this.memberSubscription$?.unsubscribe();
  }
}
