import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as dayjs from 'dayjs';
import { Space } from 'functions/interfaces/models';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Proposal } from '../../../../../../functions/interfaces/models/proposal';
import { ProposalAnswer, ProposalType } from './../../../../../../functions/interfaces/models/proposal';
import { FileApi, FILE_SIZES } from './../../../../@api/file.api';
import { SpaceApi } from './../../../../@api/space.api';

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
  private subscriptions$: Subscription[] = [];

  constructor(private spaceApi: SpaceApi) {
    // none.
  }

  public getProgress(a: ProposalAnswer): number {
    return  (this.proposal?.results?.answers?.[a.value] || 0) / (this.proposal?.results?.total || 1) * 100;
  }

  public getAvatarSize(url?: string|null): string|undefined {
    if (!url) {
      return undefined;
    }

    return FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small);
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

  public isNativeVote(type: ProposalType|undefined): boolean {
    return (type === ProposalType.NATIVE);
  }

  public isComplete(): boolean {
    if (!this.proposal || this.isNativeVote(this.proposal.type)) {
      return false;
    }

    return (dayjs(this.proposal.settings.endDate.toDate()).isBefore(dayjs()) && !!this.proposal?.approved);
  }

  public isInProgress(): boolean {
    if (!this.proposal || this.isNativeVote(this.proposal.type)) {
      return false;
    }

    return (!this.isComplete() && !this.isPending() && !!this.proposal.approved);
  }

  public isPending(): boolean {
    if (!this.proposal || this.isNativeVote(this.proposal.type) || !this.proposal.approved) {
      return false;
    }

    return (dayjs(this.proposal.settings.startDate.toDate()).isAfter(dayjs()));
  }
}
