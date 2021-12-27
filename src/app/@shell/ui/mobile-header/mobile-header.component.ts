import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'wen-mobile-header',
  templateUrl: './mobile-header.component.html',
  styleUrls: ['./mobile-header.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileHeaderComponent {
  @Input() isLoggedIn$ = new BehaviorSubject<boolean>(false);
  @Input() isMobileMenuVisible = false;
  @Output() onVisibleChange = new EventEmitter<boolean>();
  
  public homeRoute = ROUTER_UTILS.config.base.home;
}
