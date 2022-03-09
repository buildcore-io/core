import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { Space } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Award } from '../../../../../../functions/interfaces/models/award';
import { FILE_SIZES } from "./../../../../../../functions/interfaces/models/base";
import { SpaceApi } from './../../../../@api/space.api';
import { ROUTER_UTILS } from './../../../../@core/utils/router.utils';

@UntilDestroy()
@Component({
  selector: 'wen-award-card',
  templateUrl: './award-card.component.html',
  styleUrls: ['./award-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwardCardComponent implements OnChanges, OnDestroy {
  @Input() award?: Award;
  @Input() fullWidth?: boolean;
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public path = ROUTER_UTILS.config.award.root;
  private subscriptions$: Subscription[] = [];

  constructor(
    private spaceApi: SpaceApi,
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService
  ) {
    // none.
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public ngOnChanges(): void {
    if (this.award?.space) {
      this.subscriptions$.push(this.spaceApi.listen(this.award.space).pipe(untilDestroyed(this)).subscribe(this.space$));
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
