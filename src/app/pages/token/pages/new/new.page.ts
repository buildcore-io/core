import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { MemberApi } from '@api/member.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NewService } from '@pages/token/services/new.service';

export enum StepType {
  INTRODUCTION = 'Introduction',
  METRICS = 'Metrics',
  OVERVIEW = 'Overview',
  SUMMARY = 'Summary'
}

@UntilDestroy()
@Component({
  selector: 'wen-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewPage implements OnInit {
  public currentStep = StepType.SUMMARY;
  public sections = [
    { step: StepType.INTRODUCTION, label: $localize`Introduction` },
    { step: StepType.METRICS, label: $localize`Metrics` },
    { step: StepType.OVERVIEW, label: $localize`Overview` },
    { step: StepType.SUMMARY, label: $localize`Summary` }
  ];

  constructor(
    public deviceService: DeviceService,
    public newService: NewService,
    private auth: AuthService,
    private memberApi: MemberApi
  ) {}

  public ngOnInit(): void {
    this.auth.member$?.pipe(untilDestroyed(this)).subscribe((o) => {
      if (o?.uid) {
        this.memberApi.allSpacesAsMember(o.uid).pipe(untilDestroyed(this)).subscribe(this.newService.spaces$);
      }
    });
  }

  public get stepTypes(): typeof StepType {
    return StepType;
  }

  public submit(): void {
    console.log('Submit');
  }
}
