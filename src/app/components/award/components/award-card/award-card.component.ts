import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Space } from 'functions/interfaces/models';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Award } from '../../../../../../functions/interfaces/models/award';
import { FILE_SIZES } from "./../../../../../../functions/interfaces/models/base";
import { FileApi } from './../../../../@api/file.api';
import { SpaceApi } from './../../../../@api/space.api';

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
  private subscriptions$: Subscription[] = [];

  constructor(private spaceApi: SpaceApi) {
    // none.
  }

  public getAvatarSize(url?: string|null): string|undefined {
    if (!url) {
      return undefined;
    }

    return FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small);
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
