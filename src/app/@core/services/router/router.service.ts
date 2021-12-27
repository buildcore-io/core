import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';

@Injectable({
  providedIn: 'root'
})
export class RouterService {
  public homeRoute = ROUTER_UTILS.config.base.home;

  public isHomeRoute = false;

  constructor(
    private router: Router
  ) {
    this.router.events.subscribe((obj) => {
      if (obj instanceof NavigationEnd) {
        this.isHomeRoute = this.router.url.substring(1) === this.homeRoute;
      }
    });
  }
}
