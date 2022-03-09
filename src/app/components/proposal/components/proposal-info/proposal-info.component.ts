import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { DataService } from '@pages/proposal/services/data.service';

@Component({
  selector: 'wen-proposal-info',
  templateUrl: './proposal-info.component.html',
  styleUrls: ['./proposal-info.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProposalInfoComponent {
  @Output() wenOnExportClick = new EventEmitter<void>();

  constructor(
    public data: DataService
  ) {}
}
