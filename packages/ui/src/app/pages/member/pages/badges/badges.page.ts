import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsService } from '@core/services/units';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Transaction } from '@soonaverse/interfaces';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';
import { DataService } from './../../services/data.service';

interface TokensBreakdown {
  uid: string;
  totalTokenRewards: number;
  completedAwards: number;
}

interface DetailedList {
  spaceUid: string;
  spaceAvatarUrl?: string;
  spaceName?: string;
  rewards: TokensBreakdown[];
}
@UntilDestroy()
@Component({
  selector: 'wen-badges',
  templateUrl: './badges.page.html',
  styleUrls: ['./badges.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgesPage {
  constructor(
    private auth: AuthService,
    public cache: CacheService,
    public data: DataService,
    public unitsService: UnitsService,
    public previewImageService: PreviewImageService,
    public deviceService: DeviceService,
  ) {
    // none.
  }

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }

  public trackByUid(index: number, item: Transaction) {
    return item.uid;
  }

  public get detailedReputationList$(): Observable<DetailedList[]> {
    return combineLatest([this.data.spaces$, this.data.member$]).pipe(
      untilDestroyed(this),
      map(([spaces, member]) => {
        const output: DetailedList[] = [];
        for (const s in member?.spaces || {}) {
          if (Object.prototype.hasOwnProperty.call(member!.spaces, s)) {
            const rec = member!.spaces![s];
            const space = spaces?.find((sd) => {
              return sd.uid === s;
            });

            const out: DetailedList = {
              spaceUid: s,
              spaceAvatarUrl: space?.avatarUrl,
              spaceName: space?.name,
              rewards: [],
            };

            for (const t in rec.awardStat) {
              if (Object.prototype.hasOwnProperty.call(rec.awardStat, t)) {
                out.rewards.push({
                  totalTokenRewards: rec.awardStat[t].totalReward || 0,
                  completedAwards: rec.awardStat[t].completed || 0,
                  uid: t,
                });
              }
            }

            output.push(out);
          }
        }

        return output;
      }),
    );
  }

  public get getTotalReputationList$(): Observable<TokensBreakdown[]> {
    return combineLatest([this.data.spaces$, this.data.member$]).pipe(
      untilDestroyed(this),
      map(([spaces, member]) => {
        const output: TokensBreakdown[] = [];
        for (const s in member?.spaces || {}) {
          if (Object.prototype.hasOwnProperty.call(member!.spaces, s)) {
            const rec = member!.spaces![s];
            for (const t in rec.awardStat) {
              if (Object.prototype.hasOwnProperty.call(rec.awardStat, t)) {
                const recExists = output.find((tes) => {
                  return tes.uid === t;
                });
                if (recExists) {
                  recExists.totalTokenRewards += rec.awardStat[t].totalReward || 0;
                  recExists.completedAwards += rec.awardStat[t].completed || 0;
                } else {
                  output.push({
                    totalTokenRewards: rec.awardStat[t].totalReward || 0,
                    completedAwards: rec.awardStat[t].completed || 0,
                    uid: t,
                  });
                }
              }
            }
          }
        }

        return output;
      }),
    );
  }
}
