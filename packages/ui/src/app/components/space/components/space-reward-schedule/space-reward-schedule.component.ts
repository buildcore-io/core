import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { FULL_TODO_CHANGE_TO_PAGING } from '@api/base.api';
import { StakeRewardApi } from '@api/stake_reward';
import { UnitsService } from '@core/services/units';
import { download } from '@core/utils/tools.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Space, StakeReward, Token } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import Papa from 'papaparse';
import { BehaviorSubject, Observable } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-space-reward-schedule',
  templateUrl: './space-reward-schedule.component.html',
  styleUrls: ['./space-reward-schedule.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceRewardScheduleComponent implements OnInit {
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }

  public get isOpen(): boolean {
    return this._isOpen;
  }

  @Input() token?: Token;
  @Input() space?: Space;
  @Output() wenOnClose = new EventEmitter<void>();
  public rewardsToUpload: any = [];
  public stakeRewards$: BehaviorSubject<StakeReward[] | undefined> = new BehaviorSubject<
    StakeReward[] | undefined
  >(undefined);
  public uploadStage = 0;
  public tableConfig = [
    { label: `StartDate`, key: 'startDate' },
    { label: `EndDate`, key: 'endDate' },
    { label: `TokenVestingDate`, key: 'tokenVestingDate' },
    { label: `TokensToDistribute`, key: 'tokensToDistribute' },
  ];
  private _isOpen = false;

  constructor(
    public unitsService: UnitsService,
    private cd: ChangeDetectorRef,
    private stakeRewardApi: StakeRewardApi,
  ) {}

  public ngOnInit(): void {
    // Load schedule.
    this.stakeRewardApi
      .top(undefined, FULL_TODO_CHANGE_TO_PAGING)
      .pipe(untilDestroyed(this))
      .subscribe(this.stakeRewards$);
  }

  public beforeCSVUpload(file: NzUploadFile): boolean | Observable<boolean> {
    if (!file) return false;

    Papa.parse(file as unknown as File, {
      skipEmptyLines: true,
      header: true,
      complete: (results: any) => {
        if (!results?.data?.length) {
          return;
        }

        this.rewardsToUpload = results.data.map((v: any) => {
          console.log(v);
          return {
            startDate: dayjs(v.StartDate),
            endDate: dayjs(v.EndDate),
            tokenVestingDate: dayjs(v.TokenVestingDate),
            tokensToDistribute: v.TokensToDistribute * 1000 * 1000,
          };
        });
        this.uploadStage = 2;
        this.cd.markForCheck();
        console.log('aa');
      },
    });

    return false;
  }

  public generateTemplate(): void {
    const fields = ['', ...this.tableConfig.map((r) => r.label)] as string[];

    const csv = Papa.unparse({
      fields,
      data: [],
    });

    download(`data:text/csv;charset=utf-8${csv}`, 'soonaverse_airdrop_template.csv');
  }

  public submit(): void {
    //
  }

  public close(): void {
    this.reset();
    this.rewardsToUpload = [];
    this.uploadStage = 0;
    this.wenOnClose.next();
  }

  public reset(): void {
    this.isOpen = false;
    this.rewardsToUpload = [];
    this.uploadStage = 0;
    this.cd.markForCheck();
  }
}
