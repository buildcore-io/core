import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
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
  constructor(
    private themeService: ThemeService,
    private router: Router
  ) {
  }

  public ngOnInit(): void {
    this.router.events.pipe(
      untilDestroyed(this),
      filter(e => e instanceof NavigationEnd)
    ).subscribe((obj: any) => {
      if (obj.url === '/') {
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
