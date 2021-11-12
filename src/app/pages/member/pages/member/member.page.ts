import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { BehaviorSubject } from 'rxjs';
import { Member } from './../../../../../../functions/interfaces/models/member';

@Component({
  templateUrl: './member.page.html',
  styleUrls: ['./member.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberPage implements OnInit {
  memberId = ''
  sections = [
    { route: 'activity', label: 'Activity' },
    { route: 'awards', label: 'Awards' },
    { route: 'badges', label: 'Badges' },
    { route: 'yield', label: 'Yield' }
  ]
  public drawerVisible$ = new BehaviorSubject<boolean>(false);;
  constructor(
    private route: ActivatedRoute,
    private auth: AuthService
  ) {
    // none.
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.memberId = params['memberId'];
    });
  }

  public get member$(): BehaviorSubject<Member|undefined> {
    return this.auth.member$;
  }

  public get urlToMembers(): string {
    return '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.members;
  }

  public openDrawer(): void {
    this.drawerVisible$.next(true);
  }

  public closeDrawer(): void {
    this.drawerVisible$.next(false);
  }
}
