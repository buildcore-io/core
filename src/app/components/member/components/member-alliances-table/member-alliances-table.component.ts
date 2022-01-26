import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AllianceItem } from '../member-reputation-modal/member-reputation-modal.component';

@Component({
  selector: 'wen-member-alliances-table',
  templateUrl: './member-alliances-table.component.html',
  styleUrls: ['./member-alliances-table.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberAlliancesTableComponent {

  @Input() 
  public set alliances(value: AllianceItem[]) {
    this._alliances = value;
    this.totalAwards = this.alliances.reduce((acc, alliance) => acc + alliance.awards, 0);
    this.totalXP = this.alliances.reduce((acc, alliance) => acc + alliance.XP, 0);
  }
  public get alliances(): AllianceItem[] {
    return this._alliances;
  }
  private _alliances: AllianceItem[] = [];
  public totalAwards = 0;
  public totalXP = 0;

}
