import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MemberApi } from '@api/member.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NewService } from '@pages/token/services/new.service';

export enum StepType {
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
  public currentStep = StepType.METRICS;
  public sections = [
    { step: StepType.METRICS, label: $localize`Metrics` },
    { step: StepType.OVERVIEW, label: $localize`Overview` },
    { step: StepType.SUMMARY, label: $localize`Summary` }
  ];

  constructor(
    public deviceService: DeviceService,
    public newService: NewService,
    private cd: ChangeDetectorRef,
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

  public continue(): void {
    if (this.currentStep === StepType.METRICS) {
      this.currentStep = StepType.OVERVIEW;
    } else if (this.currentStep === StepType.OVERVIEW) {
      this.currentStep = StepType.SUMMARY;
    }
    this.cd.markForCheck();
  }

  public submit(): void {
    console.log('Submit');
  }

  
}
