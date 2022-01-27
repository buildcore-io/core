import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AvatarService } from '@core/services/avatar/avatar.service';
import { MemberAllianceItem } from '../member-reputation-modal/member-reputation-modal.component';

@Component({
  selector: 'wen-member-alliances-table',
  templateUrl: './member-alliances-table.component.html',
  styleUrls: ['./member-alliances-table.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberAlliancesTableComponent {

  @Input() tableClasses = '';
  @Input()
  public set alliances(value: MemberAllianceItem[]) {
    this._alliances = value;
    this.totalAwards = this.alliances.reduce((acc, alliance) => acc + alliance.totalAwards, 0);
    this.totalXp = this.alliances.reduce((acc, alliance) => acc + alliance.totalXp, 0);
  }
  public get alliances(): MemberAllianceItem[] {
    return this._alliances;
  }
  public totalAwards = 0;
  public totalXp = 0;
  private _alliances: MemberAllianceItem[] = [];

  constructor(
    public avatarService: AvatarService
  ) {}
}
