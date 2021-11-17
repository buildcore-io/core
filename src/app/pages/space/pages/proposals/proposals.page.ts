import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Proposal, SpaceGuardian } from 'functions/interfaces/models';
import { BehaviorSubject, Subscription } from 'rxjs';
import { ProposalApi } from './../../../../@api/proposal.api';
import { SpaceApi } from './../../../../@api/space.api';

@UntilDestroy()
@Component({
  selector: 'wen-proposals',
  templateUrl: './proposals.page.html',
  styleUrls: ['./proposals.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProposalsPage implements OnInit, OnDestroy {
  public spaceId?: string;
  public proposals$: BehaviorSubject<Proposal[]|undefined> = new BehaviorSubject<Proposal[]|undefined>(undefined);
  public guardians$: BehaviorSubject<SpaceGuardian[]|undefined> = new BehaviorSubject<SpaceGuardian[]|undefined>(undefined);
  private subscriptions$: Subscription[] = [];

  constructor(
    private router: Router,
    private auth: AuthService,
    private spaceApi: SpaceApi,
    private proposalApi: ProposalApi,
    private cd: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {}

  public ngOnInit(): void {
    this.route.parent?.params.subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.space.space.replace(':', '')];
      if (id) {
        this.cancelSubscriptions();
        this.listenToIsMemberAndGuardian(id);
        this.spaceId = id;
      } else {
        this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
      }
    });

    this.guardians$.pipe(untilDestroyed(this)).subscribe(() => {
      this.cd.markForCheck();
    })
  }

  private listenToIsMemberAndGuardian(spaceId: string): void {

    this.subscriptions$.push(this.proposalApi.listenForSpace(spaceId).pipe(untilDestroyed(this)).subscribe(this.proposals$));
    this.subscriptions$.push(this.spaceApi.listenGuardians(spaceId).pipe(untilDestroyed(this)).subscribe(this.guardians$));
  }

  public loggedInMemberIsGuardian(): boolean {
    if (!this.guardians$.value) {
      return false;
    }

    const currentMemberId: string | undefined = this.auth.member$?.value?.uid;
    if (!currentMemberId) {
      return false;
    }

    return this.guardians$.value.filter(e => e.uid === currentMemberId).length > 0;
  }

  public create(): void {
    this.router.navigate([
      ('/' + ROUTER_UTILS.config.proposal.root),
      ROUTER_UTILS.config.proposal.newProposal,
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
