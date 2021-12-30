import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DataService } from '@pages/proposal/services/data.service';
import { Proposal, ProposalSubType } from 'functions/interfaces/models';

@Component({
  selector: 'wen-proposal-info',
  templateUrl: './proposal-info.component.html',
  styleUrls: ['./proposal-info.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProposalInfoComponent {
  @Input() data?: DataService;
  @Input() getVotingTypeText: (subType: ProposalSubType|undefined) => string = (subType: ProposalSubType|undefined) => '';
  @Input() getCommenceDate: (proposal?: Proposal|null) => Date|null = (proposal?: Proposal|null) => null;
  @Input() getStartDate: (proposal?: Proposal|null) => Date|null = (proposal?: Proposal|null) => null;
  @Input() getEndDate: (proposal?: Proposal|null) => Date|null = (proposal?: Proposal|null) => null;
  @Output() onExportClick = new EventEmitter<void>();
}
