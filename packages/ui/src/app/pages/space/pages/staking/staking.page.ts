import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { ThemeList, ThemeService } from '@core/services/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/space/services/data.service';
import { MAX_WEEKS_TO_STAKE, MIN_WEEKS_TO_STAKE, SOON_SPACE } from '@soonaverse/interfaces';
import { map, Observable } from 'rxjs';

interface Rewards {
  key: string;
  category: string;
  level: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
  level5: string;
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
  public amountControl: FormControl = new FormControl(null, [Validators.required]);
  public weekControl: FormControl = new FormControl(1, [
    Validators.required,
    Validators.min(MIN_WEEKS_TO_STAKE),
    Validators.min(MAX_WEEKS_TO_STAKE),
  ]);

  public stakeControl: FormControl = new FormControl({ value: 0, disabled: true });
  public earnControl: FormControl = new FormControl({ value: 0, disabled: true });
  constructor(public themeService: ThemeService, public data: DataService) {}

  public ngOnInit(): void {
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
  }
  public isSoonSpace(): Observable<boolean> {
    return this.data.space$.pipe(
      map((s) => {
        return s?.uid === SOON_SPACE;
      }),
    );
  }

  listOfData: Rewards[] = [
    {
      key: '1',
      category: 'Requirements',
      level: 'Staked value*',
      level1: '0',
      level2: '',
      level3: '',
      level4: '',
      level5: ''
    },
    {
      key: '2',
      category: 'SOON Rewards',
      level: '',
      level1: '0',
      level2: '',
      level3: '',
      level4: '',
      level5: ''
    },
    {
      key: '3',
      category: 'Token Trading Discounts',
      level: '',
      level1: '0',
      level2: '',
      level3: '',
      level4: '',
      level5: ''
    },
    {
      key: '4',
      category: 'NFT Trading Discounts',
      level: '',
      level1: '0',
      level2: '',
      level3: '',
      level4: '',
      level5: ''
    },
    {
      key: '5',
      category: 'Extra Features',
      level: 'Create own space and collections',
      level1: '-',
      level2: '',
      level3: '',
      level4: '',
      level5: ''
    },
  ];
}
