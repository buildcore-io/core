import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MemberApi } from '@api/member.api';
import { TokenApi } from '@api/token.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { NotificationService } from '@core/services/notification';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AllocationType, NewService } from '@pages/token/services/new.service';

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
  public currentStep = StepType.INTRODUCTION;
  public sections = [
    { step: StepType.INTRODUCTION, label: $localize`Introduction` },
    { step: StepType.METRICS, label: $localize`Metrics` },
    { step: StepType.OVERVIEW, label: $localize`Overview` },
    { step: StepType.SUMMARY, label: $localize`Summary` }
  ];

  constructor(
    public deviceService: DeviceService,
    public newService: NewService,
    private notification: NotificationService,
    private auth: AuthService,
    private memberApi: MemberApi,
    private tokenApi: TokenApi,
    private router: Router
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

  private validateForm(): boolean {
    this.newService.tokenForm.updateValueAndValidity();
    if (!this.newService.tokenForm.valid) {
      Object.values(this.newService.tokenForm.controls).forEach((control) => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });
      return false;
    }
    const total = (this.newService.allocations.value as AllocationType[]).reduce((acc, act) => acc + Number(act.percentage), 0)
    if (total !== 100) {
      return false;
    }
    return true;
  }

  public formatSubmitData(data: any): any {
    const res: any = {};

    res.name = data.name;
    res.symbol = data.symbol;
    res.title = data.title;
    res.description = data.description;
    res.space = data.space;
    res.pricePerToken = Number(data.price) * 1000 * 1000;
    res.totalSupply = Number(data.totalSupply);
    res.allocations = data.allocations;
    res.links = data.links.map((l: { url: string }) => l.url);
    res.icon = data.icon;
    res.overviewGraphics = data.introductionary;
    res.termsAndConditionsLink = data.termsAndConditionsLink;

    return res;
  }

  public async submit(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }
    await this.auth.sign(
      this.formatSubmitData(this.newService.tokenForm.value),
      (sc, finish) => {
        this.notification
          .processRequest(this.tokenApi.create(sc), 'Created.', finish)
          .subscribe((val: any) => {
            this.router.navigate([
              ROUTER_UTILS.config.token.root,
              val?.uid,
            ]);
          });
      },
    );
  }
}
