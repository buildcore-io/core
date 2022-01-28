import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AvatarService } from '@core/services/avatar/avatar.service';
import { Member, Space } from "functions/interfaces/models";
import { CacheService } from './../../../../@core/services/cache/cache.service';

interface MemberAllianceItem {
  avatar?: string;
  name: string;
  totalAwards: number;
  totalXp: number;
}

@Component({
  selector: 'wen-member-alliances-table',
  templateUrl: './member-alliances-table.component.html',
  styleUrls: ['./member-alliances-table.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberAlliancesTableComponent {
  @Input() selectedSpace?: string;
  @Input() member?: Member | null;
  @Input() tableClasses = '';
  constructor(
    public avatarService: AvatarService,
    private cache: CacheService
  ) {}

  public getSelectedSpace(): Space | undefined {
    return this.cache.allSpaces$.value.find((s) => {
      return s.uid === this.selectedSpace;
    });
  }

  public getTotal(what: 'awardsCompleted'|'totalReputation'): number { // awardsCompleted
    let total = 0;
    total = this.member?.spaces?.[this.getSelectedSpace()!.uid]?.[what] || 0;
    for (const [spaceId, values] of Object.entries(this.getSelectedSpace()?.alliances || {})) {
      const allianceSpace: Space | undefined = this.cache.allSpaces$.value.find((s) => {
        return s.uid === spaceId;
      });
      if (allianceSpace && values.enabled === true ) {
        const value: number = this.member?.spaces?.[allianceSpace.uid]?.[what] || 0;
        total += Math.trunc((what === 'totalReputation') ? (value * values.weight) : value);
      }
    }

    return Math.trunc(total);
  }

  public getAlliances(): MemberAllianceItem[] {
    if (!this.getSelectedSpace() || !this.member) {
      return [];
    }

    const out: MemberAllianceItem[] = [];
    for (const [spaceId, values] of Object.entries(this.getSelectedSpace()?.alliances || {})) {
      const allianceSpace: Space | undefined = this.cache.allSpaces$.value.find((s) => {
        return s.uid === spaceId;
      });
      if (
        allianceSpace &&
        values.enabled === true
      ) {
        out.push({
          avatar: allianceSpace.avatarUrl,
          name: allianceSpace.name || allianceSpace.uid,
          totalAwards: this.member!.spaces?.[allianceSpace.uid]?.awardsCompleted || 0,
          totalXp: Math.trunc(((this.member!.spaces?.[allianceSpace.uid]?.totalReputation) || 0) * values.weight)
        });
      }
    }

    out.push({
      avatar: this.getSelectedSpace()!.avatarUrl,
      name: this.getSelectedSpace()!.name || this.getSelectedSpace()!.uid,
      totalAwards: this.member!.spaces?.[this.getSelectedSpace()!.uid]?.awardsCompleted || 0,
      totalXp: this.member!.spaces?.[this.getSelectedSpace()!.uid]?.totalReputation || 0
    });

    return out;
  }
}
