import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { SpaceApi } from '@api/space.api';
import { AuthService } from '@components/auth/services/auth.service';
import { ShareComponentSize } from '@components/share/share.component';
import { Token } from '@functions/interfaces/models/token';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/token/services/data.service';
import { BehaviorSubject, combineLatest, of, switchMap } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-token-buy',
  templateUrl: './token-buy.component.html',
  styleUrls: ['./token-buy.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenBuyComponent implements OnInit {
  public isBuyTokensVisible = false;
  public isScheduleSaleVisible = false;
  public isEditTokenVisible = false;
  public isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  constructor(
    public data: DataService,
    private spaceApi: SpaceApi,
    private auth: AuthService
  ) {}

  public ngOnInit(): void {
    combineLatest([this.auth.member$, this.data.token$])
      .pipe(
        switchMap(([member, token]) => {
          if (member && token?.space) {
            return this.spaceApi.isGuardianWithinSpace(token?.space, member?.uid);
          }
          return of(null);
        }),
        untilDestroyed(this)
      )
      .subscribe((isGuardianWithinSpace) => {
        if (isGuardianWithinSpace !== null) {
          this.isGuardianWithinSpace$.next(isGuardianWithinSpace);
        }
      });
  }

  public getShareUrl(token?: Token | null): string {
    return token?.wenUrlShort || token?.wenUrl || window.location.href;
  }
  
  public get shareSizes(): typeof ShareComponentSize {
    return ShareComponentSize;
  }
}
