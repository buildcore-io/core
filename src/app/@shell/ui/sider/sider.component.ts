import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { GlobeIconComponent } from '@components/ui/components/icon/globe/globe.component';
import { RocketIconComponent } from '@components/ui/components/icon/rocket/rocket.component';
import { UnamusedIconComponent } from '@components/ui/components/icon/unamused/unamused.component';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject } from 'rxjs';

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
  public defaultMenuItem: MenuItem = { route: [ROUTER_UTILS.config.discover.root], icon: RocketIconComponent };
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
      this.defaultMenuItem,
      this.dashboardMenuItem,
      this.getMemberMenuItem(memberId)
    ]);
  }

  private setUnAuthMenu(): void {
    this.menuItems$.next([
      this.defaultMenuItem
    ]);
  }

  public getMemberMenuItem(memberId: string): MenuItem {
    return {
      route: [ROUTER_UTILS.config.member.root, memberId],
      icon: UnamusedIconComponent
    };
  }
}
