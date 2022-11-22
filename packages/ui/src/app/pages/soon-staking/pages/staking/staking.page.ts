import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { DeviceService } from '@core/services/device';
import { SpaceApi } from '@api/space.api';
import { TokenApi } from '@api/token.api';
import { ThemeList, ThemeService } from '@core/services/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
  MAX_WEEKS_TO_STAKE,
  MIN_WEEKS_TO_STAKE,
  SOON_SPACE,
  SOON_TOKEN,
  Space,
  Token,
  TokenStats,
} from '@soonaverse/interfaces';
import { BehaviorSubject, map, Observable, Subscription } from 'rxjs';

interface Rewards {
  key: string;
  category: string;
  level: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
  level5: string;
  level6: string;
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
    public deviceService: DeviceService
  ) {
    this.form = new FormGroup({
      amountControl: this.amountControl,
      weekControl: this.weekControl,
    });
  }

  public ngOnInit(): void {
    this.deviceService.viewWithSearch$.next(false);

    this.amountControl.valueChanges.pipe(untilDestroyed(this)).subscribe((v) => {
      if (v > 0) {
        this.stakeControl.setValue(
          ((1 + (this.weekControl.value || 1) / 52) * (this.amountControl.value || 0)).toFixed(6),
        );
        // TODO Look at total pool and calc.
        this.earnControl.setValue(0.3);
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

  public listOfData: Rewards[] = [
    {
      key: '1',
      category: 'Requirements',
      level: 'Staked value*',
      level1: '0',
      level2: '1000',
      level3: '4000',
      level4: '6000',
      level5: '15,000',
      level6: '100,000'
    },
    {
      key: '2',
      category: 'SOON Rewards',
      level: '',
      level1: '0',
      level2: '+0.0025%',
      level3: '+0.0025%',
      level4: '+0.0025%',
      level5: '+0.0025%',
      level6: '+0.0025%',
    },
    {
      key: '3',
      category: 'Token Trading Discounts',
      level: '',
      level1: '0',
      level2: '25%',
      level3: '50%',
      level4: '75%',
      level5: '100%',
      level6: '100%',
    },
    {
      key: '4',
      category: 'NFT Trading Discounts',
      level: '',
      level1: '0',
      level2: '25%',
      level3: '50%',
      level4: '75%',
      level5: '100%',
      level6: '100%',
    },
    {
      key: '5',
      category: 'Extra Features',
      level: 'Create own space and collections',
      level1: '-',
      level2: '-',
      level3: '✓',
      level4: '✓',
      level5: '✓',
      level6: '✓',
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
