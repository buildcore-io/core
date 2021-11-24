import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Award } from './../../../../../../functions/interfaces/models/award';
import { DataService } from "./../../services/data.service";

enum FilterOptions {
  ACTIVE = 'active',
  COMPLETED = 'completed'
}

@UntilDestroy()
@Component({
  selector: 'wen-awards',
  templateUrl: './awards.page.html',
  styleUrls: ['./awards.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwardsPage implements OnInit, OnDestroy {
  public spaceId?: string;
  public selectedListControl: FormControl = new FormControl(FilterOptions.ACTIVE);
  private subscriptions$: Subscription[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef,
    public data: DataService
  ) {}

  public ngOnInit(): void {
    this.route.parent?.params.subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.space.space.replace(':', '')];
      if (id) {
        this.cancelSubscriptions();
        this.spaceId = id;
      } else {
        this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
      }
    });

    this.selectedListControl.valueChanges.pipe(untilDestroyed(this)).subscribe((val) => {
      if (this.spaceId && val === FilterOptions.COMPLETED) {
        this.data.listenToCompletedAwards(this.spaceId);
      }
      this.cd.markForCheck();
    });
  }

  public getList(): BehaviorSubject<Award[]|undefined> {
    if (this.selectedListControl.value === this.filterOptions.ACTIVE) {
      return this.data.awardsActive$;
    } else {
      return this.data.awardsCompleted$;
    }
  }

  public getTitle(): string {
    if (this.selectedListControl.value === this.filterOptions.ACTIVE) {
      return 'Active';
    } else {
      return 'Completed';
    }
  }

  public get filterOptions(): typeof FilterOptions {
    return FilterOptions;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public create(): void {
    this.router.navigate([
      ('/' + ROUTER_UTILS.config.award.root),
      ROUTER_UTILS.config.award.newAward,
      { space: this.spaceId }
    ]);
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
