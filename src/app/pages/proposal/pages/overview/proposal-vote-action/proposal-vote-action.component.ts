import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { DataService } from '@pages/proposal/services/data.service';
import { Timestamp } from 'functions/interfaces/models/base';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'wen-proposal-vote-action',
  templateUrl: './proposal-vote-action.component.html',
  styleUrls: ['./proposal-vote-action.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProposalVoteActionComponent {
  @Input() startDateTicker$?: BehaviorSubject<Timestamp>;
  @Output() onVote: EventEmitter<void> = new EventEmitter<void>();

  constructor(
    public auth: AuthService,
    public data: DataService
  ) { }
}
