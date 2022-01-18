import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';

@Injectable({
  providedIn: 'root'
})
export class RouterService {
  public homeRoute = ROUTER_UTILS.config.base.home;

  public isHomeRoute = false;
  public isNewRoute = false;

  public urlToNewSpace = '/' + ROUTER_UTILS.config.space.root + '/new';
  public urlToNewProposal = '/' + ROUTER_UTILS.config.proposal.root + '/new';
  public urlToNewAward = '/' + ROUTER_UTILS.config.award.root + '/new';

  constructor(
    private router: Router
  ) {
    this.updateVariables();
    
    this.router.events.subscribe((obj) => {
      if (obj instanceof NavigationEnd) {
        this.updateVariables();
      }
    });
  }

  private updateVariables(): void  {
    this.isHomeRoute = this.router.url.substring(1) === this.homeRoute;
    this.isNewRoute = [this.urlToNewSpace, this.urlToNewProposal, this.urlToNewAward].includes(this.router.url);
  }
}
