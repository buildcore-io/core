import { Location } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ResolveEnd, Router } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject } from 'rxjs';


@UntilDestroy()
@Component({
  selector: 'wen-mobile-header',
  templateUrl: './mobile-header.component.html',
  styleUrls: ['./mobile-header.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileHeaderComponent implements OnInit {
  @Input() isLoggedIn$ = new BehaviorSubject<boolean>(false);
  @Input() isMobileMenuVisible = false;
  @Input() isMemberProfile = false;
  @Input() isLandingPage = false;
  @Input() isAllowedCreation = false;
  @Input() urlToNewSpace = '';
  @Input() urlToNewProposal = '';
  @Input() urlToNewAward = '';
  @Input() goBackHeader = false;
  @Output() onVisibleChange = new EventEmitter<boolean>();
  
  public homeRoute = ROUTER_UTILS.config.base.home;

  constructor(
    public location: Location,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.router.events
      .pipe(untilDestroyed(this))
      .subscribe((obj) => {
        console.log(obj);
        if(obj instanceof ResolveEnd) {
          const goBackUrls = [this.urlToNewSpace, this.urlToNewProposal, this.urlToNewAward];
          this.goBackHeader = goBackUrls.includes(obj.url);
          this.cd.markForCheck();
        }
      });
  }
}
