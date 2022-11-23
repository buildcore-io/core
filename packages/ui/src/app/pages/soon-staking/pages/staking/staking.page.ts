import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { SpaceApi } from '@api/space.api';
import { TokenApi } from '@api/token.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { ThemeList, ThemeService } from '@core/services/theme';
import { UnitsService } from '@core/services/units';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
  MAX_WEEKS_TO_STAKE,
  MIN_WEEKS_TO_STAKE,
  SOON_SPACE,
  SOON_TOKEN,
  Space,
  StakeType,
  tiers,
  Token,
  TokenStats,
} from '@soonaverse/interfaces';
import { BehaviorSubject, map, merge, Observable, of, Subscription } from 'rxjs';

interface Rewards {
  key: string;
  category: string;
  category_extra: string;
  level0: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
}

@UntilDestroy()
@Component({
  selector: 'wen-staking',
  templateUrl: './staking.page.html',
  styleUrls: ['./staking.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StakingPage implements OnInit {
  public theme = ThemeList;
  public weeks = Array.from({ length: 52 }, (_, i) => i + 1);
  public openTokenStake: boolean = false;
  public amountControl: FormControl = new FormControl(null, [
    Validators.required,
    Validators.min(1),
  ]);
  public weekControl: FormControl = new FormControl(1, [
    Validators.required,
    Validators.min(MIN_WEEKS_TO_STAKE),
    Validators.max(MAX_WEEKS_TO_STAKE),
  ]);

  public stakeControl: FormControl = new FormControl({ value: 0, disabled: true });
  public earnControl: FormControl = new FormControl({ value: 0, disabled: true });
  public levelControl: FormControl = new FormControl({ value: 0, disabled: true });
  public form: FormGroup;
  public space$: BehaviorSubject<Space | undefined> = new BehaviorSubject<Space | undefined>(
    undefined,
  );
  public token$: BehaviorSubject<Token | undefined> = new BehaviorSubject<Token | undefined>(
    undefined,
  );
  public tokenStats$: BehaviorSubject<TokenStats | undefined> = new BehaviorSubject<
    TokenStats | undefined
  >(undefined);
  private subscriptions$: Subscription[] = [];
  constructor(
    public themeService: ThemeService,
    private cd: ChangeDetectorRef,
    private spaceApi: SpaceApi,
    private tokenApi: TokenApi,
    public previewImageService: PreviewImageService,
    public unitService: UnitsService,
    private auth: AuthService,
    public deviceService: DeviceService,
  ) {
    this.form = new FormGroup({
      amountControl: this.amountControl,
      weekControl: this.weekControl,
    });
  }

  public ngOnInit(): void {
    this.deviceService.viewWithSearch$.next(false);

    merge(this.amountControl.valueChanges, this.weekControl.valueChanges)
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        if ((this.amountControl.value || 0) > 0 && (this.weekControl.value || 0) > 0) {
          const val = (1 + (this.weekControl.value || 1) / 52) * (this.amountControl.value || 0);
          this.stakeControl.setValue(val.toFixed(6));
          const newTotal =
            (this.auth.memberSoonDistribution$.value?.stakes?.[StakeType.DYNAMIC]?.value || 0) +
            1000 * 1000 * val;
          let l = -1;
          tiers.forEach((a) => {
            if (newTotal >= a) {
              l++;
            }
          });

          this.levelControl.setValue(l);
          // TODO Look at total pool and calc.
          this.earnControl.setValue(0.3);
          this.cd.markForCheck();
        } else {
          this.stakeControl.setValue(0);
          this.earnControl.setValue(0);
        }
      });

    this.listenToSpace(SOON_SPACE);
    this.listenToToken(SOON_TOKEN);
    this.listenToTokenStatus(SOON_TOKEN);
  }

  public isSoonSpace(): Observable<boolean> {
    return this.space$.pipe(
      map((s) => {
        return s?.uid === SOON_SPACE;
      }),
    );
  }

  public listenToSpace(id: string): void {
    this.subscriptions$.push(this.spaceApi.listen(id).subscribe(this.space$));
  }

  public listenToToken(id: string): void {
    this.subscriptions$.push(this.tokenApi.listen(id).subscribe(this.token$));
  }

  public listenToTokenStatus(token: string): void {
    this.subscriptions$.push(this.tokenApi.stats(token).subscribe(this.tokenStats$));
  }

  public isOnTheLevel(level: number): Observable<boolean> {
    if (!this.amountControl.value || level === 0 || !this.levelControl.value) {
      return of(false);
    }

    return of(this.levelControl.value === level);
  }

  public listOfData: Rewards[] = [
    {
      key: '1',
      category: 'Requirements',
      category_extra: 'Staked value*', // auth.memberLevel$ | async
      level0: this.unitService.format(tiers[0], undefined, false, false, 0),
      level1: this.unitService.format(tiers[1], undefined, false, false, 0),
      level2: this.unitService.format(tiers[2], undefined, false, false, 0),
      level3: this.unitService.format(tiers[3], undefined, false, false, 0),
      level4: this.unitService.format(tiers[4], undefined, false, false, 0),
    },
    {
      key: '2',
      category: 'SOON Rewards',
      category_extra: '',
      level0: '0',
      level1: '✓',
      level2: '✓',
      level3: '✓',
      level4: '✓',
    },
    {
      key: '3',
      category: 'Token Trading Discounts',
      category_extra: '',
      level0: '0',
      level1: '25%',
      level2: '50%',
      level3: '75%',
      level4: '100%',
    },
    {
      key: '4',
      category: 'Extra Features',
      category_extra: 'Create own space and collections',
      level0: '-',
      level1: '✓',
      level2: '✓',
      level3: '✓',
      level4: '✓',
    },
  ];

  public submit(): void {
    this.form.updateValueAndValidity();
    if (!this.form.valid) {
      return;
    }

    this.openTokenStake = true;
    this.cd.markForCheck();
  }

  public cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
