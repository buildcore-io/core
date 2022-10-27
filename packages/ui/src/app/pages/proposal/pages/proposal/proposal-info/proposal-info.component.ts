import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { DataService } from '@pages/proposal/services/data.service';
import { HelperService } from '@pages/proposal/services/helper.service';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'wen-proposal-info',
  templateUrl: './proposal-info.component.html',
  styleUrls: ['./proposal-info.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProposalInfoComponent {
  @Input() isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  @Output() wenOnExportClick = new EventEmitter<void>();
  @Output() wenOnApprove = new EventEmitter<void>();
  @Output() wenOnReject = new EventEmitter<void>();
  public descriptionLabels: string[] = [
    $localize`Current Milestone`,
    $localize`Commence Date`,
    $localize`Start Date`,
    $localize`End Date`,
    $localize`Voting Type`,
    $localize`Total Weight`,
  ];

  constructor(
    public deviceService: DeviceService,
    public data: DataService,
    public helper: HelperService,
  ) {}
}