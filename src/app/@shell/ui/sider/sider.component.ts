import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject } from 'rxjs';
import { GlobeIconComponent } from './../../../components/icon/globe/globe.component';
import { MarketIconComponent } from './../../../components/icon/market/market.component';
import { RocketIconComponent } from './../../../components/icon/rocket/rocket.component';
import { UnamusedIconComponent } from './../../../components/icon/unamused/unamused.component';

interface MenuItem {
  route: string[];
  icon: any;
}

@UntilDestroy()
@Component({
  selector: 'wen-sider',
  templateUrl: './sider.component.html',
  styleUrls: ['./sider.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SiderComponent implements OnInit {
  public homeRoute = ROUTER_UTILS.config.base.home;
  public defaultMenuItem1: MenuItem = { route: [ROUTER_UTILS.config.discover.root], icon: RocketIconComponent };
  public defaultMenuItem2: MenuItem = { route: [ROUTER_UTILS.config.market.root], icon: MarketIconComponent };
  // public defaultMenuItem3: MenuItem = { route: [ROUTER_UTILS.config.discover.root], icon: MarketIconComponent };
  public dashboardMenuItem: MenuItem = { route: [ROUTER_UTILS.config.base.dashboard], icon: GlobeIconComponent };
  public menuItems$: BehaviorSubject<MenuItem[]> = new BehaviorSubject<MenuItem[]>([]);

  constructor(private auth: AuthService) {}
  public ngOnInit(): void {
    this.auth.member$.pipe(untilDestroyed(this)).subscribe((val) => {
      if (val) {
        this.setAuthMenu(val.uid);
      } else {
        this.setUnAuthMenu();
      }
    });

    // Logout
    this.auth.isLoggedIn$.pipe(untilDestroyed(this)).subscribe((val) => {
      if (val === false) {
        this.setUnAuthMenu();
      }
    });
  }

  private setAuthMenu(memberId: string): void {
    this.menuItems$.next([
      this.defaultMenuItem1,
      this.defaultMenuItem2,
      this.dashboardMenuItem,
      this.getMemberMenuItem(memberId)
    ]);
  }

  private setUnAuthMenu(): void {
    this.menuItems$.next([
      this.defaultMenuItem1,
      this.defaultMenuItem2
    ]);
  }

  public getMemberMenuItem(memberId: string): MenuItem {
    return {
      route: [ROUTER_UTILS.config.member.root, memberId],
      icon: UnamusedIconComponent
    };
  }
}
