import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';

@Component({
  selector: 'wen-awards',
  templateUrl: './awards.page.html',
  styleUrls: ['./awards.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwardsPage {
  constructor(private router: Router) {}
  public create(): void {
    this.router.navigate([('/' + ROUTER_UTILS.config.award.root), ROUTER_UTILS.config.award.newAward]);
  }
}
