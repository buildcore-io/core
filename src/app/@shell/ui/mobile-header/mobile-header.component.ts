import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { RouterService } from '@core/services/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy } from '@ngneat/until-destroy';
import { BehaviorSubject } from 'rxjs';


@UntilDestroy()
@Component({
  selector: 'wen-mobile-header',
  templateUrl: './mobile-header.component.html',
  styleUrls: ['./mobile-header.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileHeaderComponent {
  // TODO Clean up this passing around of inputs. This messy.
  @Input() isMobileMenuVisible = false;
  @Input() isMemberProfile = false;
  @Input() isLandingPage = false;
  @Input() isAllowedCreation = false;
  @Input() goBackHeader = false;
  @Output() onVisibleChange = new EventEmitter<boolean>();

  public homeRoute = ROUTER_UTILS.config.base.home;

  constructor(
    public auth: AuthService,
    public location: Location,
    public routerService: RouterService
  ) {}

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }
}
