import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RouterService {
  public homeRoute = ROUTER_UTILS.config.base.home;

  public isHomeRoute$ = new BehaviorSubject<boolean>(false);
  public isNewRoute$ = new BehaviorSubject<boolean>(false);

  public urlToNewSpace = '/' + ROUTER_UTILS.config.space.root + '/new';
  public urlToNewProposal = '/' + ROUTER_UTILS.config.proposal.root + '/new';
  public urlToNewAward = '/' + ROUTER_UTILS.config.award.root + '/new';

  constructor(
    private router: Router
  ) {
    this.updateVariables();
    
    this.router.events.subscribe((obj) => {
      if (obj instanceof NavigationEnd) {
        console.log(obj);
        this.updateVariables();
      }
    });
  }

  private updateVariables(): void  {
    this.isHomeRoute$.next(this.router.url.substring(1) === this.homeRoute);
    this.isNewRoute$.next([this.urlToNewSpace, this.urlToNewProposal, this.urlToNewAward].includes(this.router.url));
  }
}
