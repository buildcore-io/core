import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'wen-proposals',
  templateUrl: './proposals.page.html',
  styleUrls: ['./proposals.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProposalsPage {
}
