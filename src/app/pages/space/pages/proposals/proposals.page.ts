import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';

@Component({
  selector: 'wen-proposals',
  templateUrl: './proposals.page.html',
  styleUrls: ['./proposals.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProposalsPage {
  constructor(private router: Router) {}
  public create(): void {
    this.router.navigate([('/' + ROUTER_UTILS.config.proposal.root), ROUTER_UTILS.config.proposal.newProposal]);
  }
}
