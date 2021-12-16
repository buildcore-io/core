import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { NavigationCancel, NavigationEnd, Router } from '@angular/router';
import { ThemeService } from '@core/services/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject } from "rxjs";
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
  public isMobile = false;
  public static MOBILE_MAX_WIDTH = 1023;
  constructor(
    private themeService: ThemeService,
    private cd: ChangeDetectorRef,
    private router: Router
  ) {
    this.isMobile = (window.innerWidth < LayoutComponent.MOBILE_MAX_WIDTH);
  }

  public ngOnInit(): void {
    this.router.events.pipe(
      untilDestroyed(this),
      filter((e: any) => {
        return (e instanceof NavigationEnd || e instanceof NavigationCancel);
      }))
    .subscribe((obj: any) => {
      if (obj.url === '/') {
        this.showSideBar$.next(false);
      } else {
        this.showSideBar$.next(true);
      }
    });
  }

  @HostListener('window:resize', ['$event'])
  @HostListener('window:orientationchange', ['$event'])
  public onResize(): void {
      const before = this.isMobile;
      this.isMobile = (window.innerWidth < LayoutComponent.MOBILE_MAX_WIDTH);
      if (before !== this.isMobile) {
        this.cd.markForCheck();
      }
  }

  public get isDarkTheme() {
    return this.themeService.isDarkTheme()
  }
}
