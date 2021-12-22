import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  public static MOBILE_MAX_WIDTH = 1024;
  public isDesktop$ = new BehaviorSubject<boolean>(!this.getIsMobile());
  public isMobile$ = new BehaviorSubject<boolean>(this.getIsMobile());

  constructor() { 
    fromEvent(window, 'resize').subscribe(() => {
      this.isDesktop$.next(!this.getIsMobile());
      this.isMobile$.next(this.getIsMobile());
    });
  }

  private getIsMobile(): boolean {
    return window.innerWidth < DeviceService.MOBILE_MAX_WIDTH;
  }
}
