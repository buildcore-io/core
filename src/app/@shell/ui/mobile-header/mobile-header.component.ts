import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { RouterService } from '@core/services/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy } from '@ngneat/until-destroy';


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
  @Input() goBackHeader = false;
  @Input() enableCreateAwardProposal = true;
  @Input() enableCollection = true;
  @Output() wenOnVisibleChange = new EventEmitter<boolean>();

  public homeRoute = ROUTER_UTILS.config.base.home;

  constructor(
    public auth: AuthService,
    public location: Location,
    public routerService: RouterService
  ) {}

  public setMobileMenuVisible(isVisible: boolean): void {
    this.isMobileMenuVisible = isVisible;
    this.wenOnVisibleChange.emit(isVisible);
  }

  public wenOnCreateClick(): void {
    if(this.isMobileMenuVisible) {
      this.setMobileMenuVisible(false);
    }
  }
}
