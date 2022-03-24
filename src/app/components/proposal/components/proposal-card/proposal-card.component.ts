import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { Space } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Proposal, ProposalAnswer, ProposalType } from '../../../../../../functions/interfaces/models/proposal';
import { SpaceApi } from './../../../../@api/space.api';
import { ROUTER_UTILS } from './../../../../@core/utils/router.utils';

@UntilDestroy()
@Component({
  selector: 'wen-proposal-card',
  templateUrl: './proposal-card.component.html',
  styleUrls: ['./proposal-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProposalCardComponent implements OnChanges, OnDestroy {
  @Input() proposal?: Proposal;
  @Input() fullWidth?: boolean;
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public path = ROUTER_UTILS.config.proposal.root;
  private subscriptions$: Subscription[] = [];

  constructor(
    private spaceApi: SpaceApi,
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService
  ) {}

  public getProgressForTwo(a: ProposalAnswer[]): number[] {
    if (this.proposal?.type === ProposalType.NATIVE) {
      let total = 0;
      if ((<any>this.proposal?.results)?.questions?.[0].answers) {
        (<any>this.proposal?.results)?.questions?.[0].answers.forEach((b: any) => {
          if (b.value === 0 || b.value === 255) {
            return;
          }

          total += b.accumulated || 0;
        });
      }

      const ans1: any = (<any>this.proposal?.results)?.questions?.[0].answers.find((suba: any) => {
        return suba.value === 1;
      });
      const ans2: any = (<any>this.proposal?.results)?.questions?.[0].answers.find((suba: any) => {
        return suba.value === 2;
      });

      return [
        total > 0 ? (ans1?.accumulated || 0) / (total) * 100 : 0,
        total > 0 ? (ans2?.accumulated || 0) / (total) * 100 : 0
      ]
    } else {
      const answerOne = (this.proposal?.results?.answers?.[a[0].value] || 0) / (this.proposal?.results?.total || 1) * 100;
      const answerTwo = (this.proposal?.results?.answers?.[a[1].value] || 0) / (this.proposal?.results?.total || 1) * 100;
      return [
        answerOne > 0 ? 100 - answerTwo : 0,
        answerTwo
      ];
    }
  }

  public ngOnChanges(): void {
    if (this.proposal?.space) {
      this.subscriptions$.push(this.spaceApi.listen(this.proposal.space).pipe(untilDestroyed(this)).subscribe(this.space$));
    }
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
