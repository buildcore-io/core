import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';

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

  constructor(private route: ActivatedRoute) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.memberId = params['memberId'];
    });
  }

  public get urlToMembers(): string {
    return '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.members;
  }
}
