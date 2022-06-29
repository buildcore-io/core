import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { PreviewImageService } from '@core/services/preview-image';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Member, Space } from "functions/interfaces/models";
import { combineLatest, first, map, Observable, of } from 'rxjs';
import { SpaceApi } from './../../../../@api/space.api';
import { CacheService } from './../../../../@core/services/cache/cache.service';

interface MemberAllianceItem {
  avatar?: string;
  uid: string;
  name: string;
  totalAwards: number;
  totalXp: number;
}

@UntilDestroy()
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
    [propName: string]: boolean;
  } = {};
  constructor(
    public previewImageService: PreviewImageService,
    private spaceApi: SpaceApi,
    private cd: ChangeDetectorRef,
    private cache: CacheService
  ) { }

  public ngOnInit(): void {
    this.checkIfMembersWithinSpace();
  }

  public getTotal(what: 'awardsCompleted' | 'totalReputation'): Observable<number> { // awardsCompleted
    if (Object.keys(this.selectedSpace?.alliances || {}).length === 0) {
      return of(0);
    }

    const spaceObservables: Observable<Space | undefined>[] =
      Object.entries(this.selectedSpace?.alliances || {}).map(([spaceId]) => this.cache.getSpace(spaceId));

    return combineLatest(spaceObservables)
      .pipe(
        map(allianceSpaces => {
          let total = this.member?.spaces?.[this.selectedSpace?.uid || 0]?.[what] || 0;
          for (const allianceSpace of allianceSpaces) {
            if (allianceSpace && this.selectedSpace?.alliances[allianceSpace.uid].enabled === true) {
              const value: number = this.member?.spaces?.[allianceSpace.uid]?.[what] || 0;
              total += Math.trunc((what === 'totalReputation') ?
                (value * this.selectedSpace?.alliances[allianceSpace.uid].weight) : value);
            }
          }
          return Math.trunc(total);
        })
      );
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

  public getAlliances(): Observable<MemberAllianceItem[]> {
    if (!this.selectedSpace || !this.member || Object.keys(this.selectedSpace?.alliances || {}).length === 0) {
      return of(<MemberAllianceItem[]>[]);
    }

    const spaceObservables: Observable<Space | undefined>[] =
      Object.entries(this.selectedSpace?.alliances || {}).map(([spaceId]) => this.cache.getSpace(spaceId));

    return combineLatest(spaceObservables)
      .pipe(
        map(allianceSpaces => {
          const out: MemberAllianceItem[] = [];
          for (const allianceSpace of allianceSpaces) {
            if (
              allianceSpace &&
              this.selectedSpace?.alliances[allianceSpace.uid].enabled === true
            ) {
              if (this.member) {
                out.push({
                  uid: allianceSpace.uid,
                  avatar: allianceSpace.avatarUrl,
                  name: allianceSpace.name || allianceSpace.uid,
                  totalAwards: this.member.spaces?.[allianceSpace.uid]?.awardsCompleted || 0,
                  totalXp: Math.trunc(((this.member.spaces?.[allianceSpace.uid]?.totalReputation) || 0) * this.selectedSpace?.alliances[allianceSpace.uid].weight)
                });
              }
            }
          }

          if (this.member && this.selectedSpace) {
            out.push({
              uid: this.selectedSpace.uid,
              avatar: this.selectedSpace.avatarUrl,
              name: this.selectedSpace.name || this.selectedSpace.uid,
              totalAwards: this.member.spaces?.[this.selectedSpace.uid]?.awardsCompleted || 0,
              totalXp: this.member.spaces?.[this.selectedSpace.uid]?.totalReputation || 0
            });
          }
          return out;
        })
      );
  }

  public trackByUid(index: number, item: Member) {
    return item.uid;
  }
}
