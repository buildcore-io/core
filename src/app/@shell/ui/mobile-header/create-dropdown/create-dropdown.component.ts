import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'wen-create-dropdown',
  templateUrl: './create-dropdown.component.html',
  styleUrls: ['./create-dropdown.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateDropdownComponent {
  // TODO Clean up this passing around of inputs. This messy.
  @Input() isLoggedIn$ = new BehaviorSubject<boolean>(false);
  @Input() isMemberProfile = false;
  @Input() isLandingPage = false;
  @Input() isAllowedCreation = false;
  @Input() urlToNewSpace = '';
  @Input() urlToNewProposal = '';
  @Input() urlToNewAward = '';
}
