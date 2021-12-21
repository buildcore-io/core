import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  public static MOBILE_MAX_WIDTH = 1023;
  public isMobile$ = new BehaviorSubject<boolean>(this.getIsMobile());

  constructor() { 
    fromEvent(window, 'resize').subscribe(() => this.isMobile$.next(this.getIsMobile()));
  }

  private getIsMobile(): boolean {
    return window.innerWidth < DeviceService.MOBILE_MAX_WIDTH;
  }
}
