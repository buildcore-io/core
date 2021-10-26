import { Injectable } from '@angular/core';
import { getItem, removeItem, setItem, StorageItem } from '@core/utils';
import detectEthereumProvider from '@metamask/detect-provider';
import { BehaviorSubject } from 'rxjs';
import Web3 from 'web3';
import Web3Token from 'web3-token';

export interface DecodedToken {
  address: string;
  body: any;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private web3: any;
  isLoggedIn$ = new BehaviorSubject<boolean>(!!getItem(StorageItem.Auth));

  get isLoggedIn(): boolean {
    return this.isLoggedIn$.getValue();
  }

  async signWithMetamask(params: any = {}, expiresIn = '15s'): Promise<string|undefined> {
    const provider: any = await detectEthereumProvider();
    if (provider) {
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

      return token;
    } else {
      console.log('Please install MetaMask!');
      return undefined;
    }
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
  }
}
