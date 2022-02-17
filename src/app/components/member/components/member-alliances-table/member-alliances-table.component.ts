import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { AvatarService } from '@core/services/avatar';
import { Member, Space } from "functions/interfaces/models";
import { first } from 'rxjs';
import { SpaceApi } from './../../../../@api/space.api';
import { CacheService } from './../../../../@core/services/cache/cache.service';

interface MemberAllianceItem {
  avatar?: string;
  uid: string;
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
export class MemberAlliancesTableComponent implements OnInit {
  @Input() selectedSpace?: Space;
  @Input() member?: Member | null;
  @Input() tableClasses = '';
  public memberWithinSpace: {
    [propName: string]: boolean
  } = {};
  constructor(
    public avatarService: AvatarService,
    private spaceApi: SpaceApi,
    private cd: ChangeDetectorRef,
    private cache: CacheService
  ) {}

  public ngOnInit(): void {
    this.checkIfMembersWithinSpace();
  }

  public getTotal(what: 'awardsCompleted'|'totalReputation'): number { // awardsCompleted
    let total = 0;
    total = this.member?.spaces?.[this.selectedSpace?.uid || 0]?.[what] || 0;
    for (const [spaceId, values] of Object.entries(this.selectedSpace?.alliances || {})) {
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

  public checkIfMembersWithinSpace(): void {
    if (!this.member) {
      return;
    }
    for (const [spaceId] of Object.entries(this.selectedSpace?.alliances || {})) {
      this.spaceApi.isMemberWithinSpace(spaceId, this.member.uid).pipe(first()).subscribe((val) => {
        this.memberWithinSpace[spaceId] = val;
        this.cd.markForCheck();
      });
    }
  }

  public getAlliances(): MemberAllianceItem[] {
    if (!this.selectedSpace || !this.member) {
      return [];
    }

    const out: MemberAllianceItem[] = [];
    for (const [spaceId, values] of Object.entries(this.selectedSpace?.alliances || {})) {
      const allianceSpace: Space | undefined = this.cache.allSpaces$.value.find((s) => {
        return s.uid === spaceId;
      });
      if (
        allianceSpace &&
        values.enabled === true
      ) {
        out.push({
          uid: allianceSpace.uid,
          avatar: allianceSpace.avatarUrl,
          name: allianceSpace.name || allianceSpace.uid,
          totalAwards: this.member!.spaces?.[allianceSpace.uid]?.awardsCompleted || 0,
          totalXp: Math.trunc(((this.member!.spaces?.[allianceSpace.uid]?.totalReputation) || 0) * values.weight)
        });
      }
    }

    out.push({
      uid: this.selectedSpace!.uid,
      avatar: this.selectedSpace!.avatarUrl,
      name: this.selectedSpace!.name || this.selectedSpace!.uid,
      totalAwards: this.member!.spaces?.[this.selectedSpace!.uid]?.awardsCompleted || 0,
      totalXp: this.member!.spaces?.[this.selectedSpace!.uid]?.totalReputation || 0
    });

    return out;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
