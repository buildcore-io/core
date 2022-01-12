import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NavigationCancel, NavigationEnd, Router } from '@angular/router';
import { DeviceService } from '@core/services/device';
import { RouterService } from '@core/services/router';
import { ThemeService } from '@core/services/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest } from "rxjs";
import { filter } from 'rxjs/operators';

@UntilDestroy()
@Component({
  selector: 'wen-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent implements OnInit {
  public showSideBar$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);
  constructor(
    private themeService: ThemeService,
    private cd: ChangeDetectorRef,
    private router: Router,
    private deviceService: DeviceService,
    public routerService: RouterService
  ) { }

  public ngOnInit(): void {
    combineLatest([
      this.router.events,
      this.deviceService.isMobile$
    ]).pipe(
      untilDestroyed(this),
      filter(([routerEvent, isMobile]: [any, boolean]) => {
        return routerEvent && (routerEvent instanceof NavigationEnd || routerEvent instanceof NavigationCancel);
      }))
    .subscribe(([routerEvent, isMobile]: [any, boolean]) => {
      if (routerEvent.url === '/' || isMobile) {
        this.showSideBar$.next(false);
      } else {
        this.showSideBar$.next(true);
      }
    });
  }

  public get isDarkTheme() {
    return this.themeService.isDarkTheme()
  }
}
