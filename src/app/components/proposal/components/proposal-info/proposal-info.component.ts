import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { DataService } from '@pages/proposal/services/data.service';
import { Proposal, ProposalQuestion, ProposalSubType } from 'functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'wen-proposal-info',
  templateUrl: './proposal-info.component.html',
  styleUrls: ['./proposal-info.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProposalInfoComponent {
  @Input() data?: DataService;
  @Input() isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  @Input() getVotingTypeText: (subType: ProposalSubType|undefined) => string = (subType: ProposalSubType|undefined) => '';
  @Input() getCommenceDate: (proposal?: Proposal|null) => Date|null = (proposal?: Proposal|null) => null;
  @Input() getStartDate: (proposal?: Proposal|null) => Date|null = (proposal?: Proposal|null) => null;
  @Input() getEndDate: (proposal?: Proposal|null) => Date|null = (proposal?: Proposal|null) => null;
  @Input() findAnswerText: (qs: ProposalQuestion[]|undefined, values: number[]) => string =
    (qs: ProposalQuestion[]|undefined, values: number[]) => '';
  @Output() onExportClick = new EventEmitter<void>();
  @Output() onApprove = new EventEmitter<void>();
  @Output() onReject = new EventEmitter<void>();

  constructor(
    public deviceService: DeviceService
  ) {}
}
