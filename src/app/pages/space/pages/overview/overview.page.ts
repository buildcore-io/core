import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Award, Proposal } from '@functions/interfaces/models';
import { Token, TokenStatus } from '@functions/interfaces/models/token';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from "@pages/space/services/data.service";
import dayjs from 'dayjs';
import { Subscription } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-overview',
  templateUrl: './overview.page.html',
  styleUrls: ['./overview.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewPage implements OnInit, OnDestroy {
  public spaceId?: string;
  public filteredToken?: Token | null;
  private subscriptions$: Subscription[] = [];

  constructor(
    public data: DataService,
    private route: ActivatedRoute,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    this.route.parent?.params.subscribe((obj) => {
      const id: string | undefined = obj?.[ROUTER_UTILS.config.space.space.replace(':', '')];
      if (id) {
        this.cancelSubscriptions();
        this.spaceId = id;
        this.data.listenToTokens(this.spaceId);
      } else {
        this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
      }
    });

    this.data.token$
      .pipe(
        untilDestroyed(this)
      )
      .subscribe((token: Token | undefined) => {
        this.filteredToken = (token?.saleStartDate && this.available(token)) ? token : token;
        this.cd.markForCheck();
      });
  }

  public available(token: Token): boolean {
    return (
      // dayjs(token.saleStartDate?.toDate()).isAfter(dayjs()) &&
      dayjs(token.saleStartDate?.toDate()).add(token.saleLength || 0, 'ms').isAfter(dayjs()) &&
      token?.status === TokenStatus.AVAILABLE &&
      token?.approved === true
    );
  }

  public trackByUid(index: number, item: Award | Proposal) {
    return item.uid;
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
