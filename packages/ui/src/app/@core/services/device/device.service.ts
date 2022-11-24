import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, debounceTime, fromEvent } from 'rxjs';

export const LAYOUT_CHANGE_DEBOUNCE_TIME = 50;

@Injectable({
  providedIn: 'root',
})
export class DeviceService {
  public static MOBILE_MAX_WIDTH = 1024;
  public viewWithSearch$ = new BehaviorSubject<boolean>(true);
  public isDesktop$ = new BehaviorSubject<boolean>(false);
  public isMobile$ = new BehaviorSubject<boolean>(false);
  public innerWidth$ = new BehaviorSubject<number>(0);
  public scrollX$ = new BehaviorSubject<number>(0);
  public scrollY$ = new BehaviorSubject<number>(0);

  constructor(@Inject(PLATFORM_ID) private platformId: Record<string, unknown>) {
    this.setDevice();
    this.setScroll();

    fromEvent(window, 'resize')
      .pipe(debounceTime(LAYOUT_CHANGE_DEBOUNCE_TIME))
      .subscribe(this.setDevice.bind(this));
    fromEvent(window, 'scroll')
      .pipe(debounceTime(LAYOUT_CHANGE_DEBOUNCE_TIME))
      .subscribe(this.setScroll.bind(this));
  }

  public get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private setDevice(): void {
    this.isDesktop$.next(!this.getIsMobile());
    this.isMobile$.next(this.getIsMobile());
    this.innerWidth$.next(window?.innerWidth);
  }

  private setScroll(): void {
    this.scrollX$.next(window?.scrollX);
    this.scrollY$.next(window?.scrollY);
  }

  private getIsMobile(): boolean {
    return window?.innerWidth < DeviceService.MOBILE_MAX_WIDTH;
  }
}
