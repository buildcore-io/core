import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Proposal } from '../../../../../../functions/interfaces/models/proposal';

@Component({
  selector: 'wen-proposal-card',
  templateUrl: './proposal-card.component.html',
  styleUrls: ['./proposal-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProposalCardComponent {
  @Input() proposal?: Proposal;
  @Input() fullWidth?: boolean;
}
