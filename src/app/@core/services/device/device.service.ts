import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  public static MOBILE_MAX_WIDTH = 1024;
  public isDesktop$ = new BehaviorSubject<boolean>(false);
  public isMobile$ = new BehaviorSubject<boolean>(false);
  public innerWidth$ = new BehaviorSubject<number>(0);

  constructor() { 
    this.setDevice();
    fromEvent(window, 'resize')
      .subscribe(this.setDevice.bind(this));
  }

  private setDevice(): void {
    this.isDesktop$.next(!this.getIsMobile());
    this.isMobile$.next(this.getIsMobile());
    this.innerWidth$.next(window.innerWidth);
  }

  private getIsMobile(): boolean {
    return window.innerWidth < DeviceService.MOBILE_MAX_WIDTH;
  }
}
