import { Injectable, OnDestroy } from '@angular/core';
import { Router, RoutesRecognized } from '@angular/router';
import { ROUTER_UTILS } from "@core/utils/router.utils";
import { filter, pairwise, Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NavigationService implements OnDestroy {
  private subsRouter$?: Subscription;
  private returnUrl: string[][] = [['/discover']];
  private returnText: string[] = ['Discover'];

  constructor(
    private router: Router
  ) {
    // None.
  }

  public watchPathHistory(): void {
    this.subsRouter$ = this.router.events
    .pipe(filter((evt: any) => evt instanceof RoutesRecognized), pairwise())
    .subscribe((events: RoutesRecognized[]) => {
      const prevUrl = events[0].urlAfterRedirects;
      const targetUrl = events[1].urlAfterRedirects;
      this.returnableUrl().forEach((o) => {
        if (prevUrl.startsWith('/' + o.url) && !targetUrl.startsWith('/' + o.url)) {
          this.returnUrl.push(prevUrl.split('/'));
          this.returnText.push(o.text);
        }
      });
    });
  }

  private returnableUrl(): {url: string, text: string}[] {
    return [
      { url: ROUTER_UTILS.config.space.root, text: 'Space' },
      { url: ROUTER_UTILS.config.discover.root, text: 'Discover' },
      { url: ROUTER_UTILS.config.member.root, text: 'Profile' },
      { url: ROUTER_UTILS.config.market.root, text: 'Marketplace' },
      { url: ROUTER_UTILS.config.collection.root, text: 'Collection' },
      // { url: ROUTER_UTILS.config.award.root, text: 'Award' },
      // { url: ROUTER_UTILS.config.proposal.root, text: 'Proposal' },
    ];
  }

  public getLastUrl(): string[] {
    return this.returnUrl[this.returnUrl.length - 1];
  }

  public getTitle(): string {
    return 'Back ' + (this.returnText[this.returnText.length - 1] || '');
  }

  public goBack(): void {
    const url = [...this.getLastUrl()];
    this.returnUrl.splice(this.returnUrl.length - 1);
    this.returnText.splice(this.returnText.length - 1);
    this.router.navigate(url);
  }

  public ngOnDestroy(): void {
    if (this.subsRouter$) {
      this.subsRouter$.unsubscribe();
    }
  }
}
