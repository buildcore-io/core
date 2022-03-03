import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, Router } from '@angular/router';
import { AwardApi } from "@api/award.api";
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Proposal } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, first, firstValueFrom, map, skip, Subscription } from 'rxjs';
import { WEN_NAME } from './../../../../../../functions/interfaces/config';
import { Award } from './../../../../../../functions/interfaces/models/award';
import { FILE_SIZES } from "./../../../../../../functions/interfaces/models/base";
import { Milestone } from './../../../../../../functions/interfaces/models/milestone';
import { ProposalType } from './../../../../../../functions/interfaces/models/proposal';
import { MemberApi } from './../../../../@api/member.api';
import { MilestoneApi } from './../../../../@api/milestone.api';
import { ProposalApi } from './../../../../@api/proposal.api';
import { SpaceApi } from './../../../../@api/space.api';
import { NavigationService } from './../../../../@core/services/navigation/navigation.service';
import { NotificationService } from './../../../../@core/services/notification/notification.service';
import { UnitsHelper } from './../../../../@core/utils/units-helper';
import { DataService as ProposalDataService } from './../../services/data.service';

@UntilDestroy()
@Component({
  selector: 'wen-proposal',
  templateUrl: './proposal.page.html',
  styleUrls: ['./proposal.page.less']
})
export class ProposalPage implements OnInit, OnDestroy {
  public sections = [
    { route: [ROUTER_UTILS.config.proposal.overview], label: 'Overview' }
  ];
  public isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public isProposaslInfoVisible = false;
  private subscriptions$: Subscription[] = [];
  private guardiansSubscription$?: Subscription;
  private currentMemberVotedTransSubscription$?: Subscription;
  private canVoteSubscription$?: Subscription;
  private proposalId?: string;

  constructor(
    private titleService: Title,
    private auth: AuthService,
    private router: Router,
    private notification: NotificationService,
    private spaceApi: SpaceApi,
    private route: ActivatedRoute,
    private proposalApi: ProposalApi,
    private memberApi: MemberApi,
    private awardApi: AwardApi,
    private milestoneApi: MilestoneApi,
    private cd: ChangeDetectorRef,
    public proposalData: ProposalDataService,
    public previewImageService: PreviewImageService,
    public nav: NavigationService,
    public deviceService: DeviceService
  ) {
    // none.
  }

  public ngOnInit(): void {
    this.titleService.setTitle(WEN_NAME + ' - ' + 'Proposal');
    this.route.params.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.proposal.proposal.replace(':', '')];
      if (id) {
        this.listenToProposal(id);
      } else {
        this.notFound();
      }
    });

    // If we're unable to find the space we take the user out as well.
    this.proposalData.proposal$.pipe(skip(1), untilDestroyed(this)).subscribe((obj: Proposal|undefined) => {
      if (!obj) {
        this.notFound();
        return;
      }

      // Once we load proposal let's load guardians for the space.
      if (this.guardiansSubscription$) {
        this.guardiansSubscription$.unsubscribe();
      }

      if (this.auth.member$.value?.uid) {
        this.guardiansSubscription$ = this.spaceApi.isGuardianWithinSpace(obj.space, this.auth.member$.value.uid)
                                      .pipe(untilDestroyed(this)).subscribe(this.isGuardianWithinSpace$);
      }

      if (obj.type !== ProposalType.NATIVE && this.sections.length === 1) {
        this.sections.push({ route: [ROUTER_UTILS.config.proposal.participants], label: 'Participants' });
        this.sections = [...this.sections];
        this.cd.markForCheck();
      }
    });

    // Guardians might be refreshed alter and we need to apply that on view.
    this.proposalData.guardians$.subscribe(() => {
      this.cd.markForCheck();
    });

    // Once we get proposal get space.
    this.proposalData.proposal$.pipe(skip(1), first()).subscribe(async (p) => {
      if (p) {
        this.subscriptions$.push(this.spaceApi.listen(p.space).pipe(untilDestroyed(this)).subscribe(this.proposalData.space$));
        if (p.createdBy) {
          this.subscriptions$.push(this.memberApi.listen(p.createdBy).pipe(untilDestroyed(this)).subscribe(this.proposalData.creator$));
        }

        // Get badges to show.
        const awards: Award[] = [];
        if (p.settings.awards?.length) {
          for (const a of p.settings.awards) {
            const award: Award|undefined = await firstValueFrom(this.awardApi.listen(a));
            if (award) {
              awards.push(award);
            }
          }
        }

        this.proposalData.badges$.next(awards);
      }
    });

    this.auth.member$.pipe(untilDestroyed(this)).subscribe((member) => {
      this.currentMemberVotedTransSubscription$?.unsubscribe();
      this.canVoteSubscription$?.unsubscribe();
      if (member?.uid && this.proposalId) {
        this.currentMemberVotedTransSubscription$ = this.proposalApi.getMembersVotes(this.proposalId, member.uid).subscribe(this.proposalData.currentMembersVotes$);
        this.currentMemberVotedTransSubscription$ = this.proposalApi.canMemberVote(this.proposalId, member.uid).subscribe(this.proposalData.canVote$);
      } else {
        this.proposalData.currentMembersVotes$.next(undefined);
        this.proposalData.canVote$.next(false);
      }
    });

    this.milestoneApi.top(undefined, undefined, 1).pipe(untilDestroyed(this), map((o: Milestone[]) => {
      return o[0];
    })).subscribe(this.proposalData.lastMilestone$);
  }

  public fireflyNotSupported(): void {
    alert('Firefly deep links does not support this option yet. Use CLI wallet instead.');
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  private listenToProposal(id: string): void {
    this.proposalId = id;
    this.cancelSubscriptions();
    this.subscriptions$.push(this.proposalApi.listen(id).pipe(untilDestroyed(this)).subscribe(this.proposalData.proposal$));
    this.subscriptions$.push(this.proposalApi.lastVotes(id).pipe(untilDestroyed(this)).subscribe(this.proposalData.transactions$));
  }

  public memberIsPartOfVote(memberId: string): boolean {
    if (!this.proposalData.guardians$.value) {
      return false;
    }

    return this.proposalData.guardians$.value.filter(e => e.uid === memberId).length > 0;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public formatBest(proposal: Proposal|null|undefined, value: number): string {
    if (!proposal) {
      return '';
    }

    // ?.results?.questions?.[0].answers[a.value]?.accumulated || 0
    const ans: any = (<any>proposal?.results)?.questions?.[0].answers.find((suba: any) => {
      return suba.value === value;
    });
    if(!ans) {
      return '';
    }
    return UnitsHelper.formatBest(ans.accumulated);
  }

  public async approve(): Promise<void> {
    if (!this.proposalData.proposal$.value?.uid) {
      return;
    }

    await this.auth.sign({
        uid: this.proposalData.proposal$.value.uid
    }, (sc, finish) => {
      this.notification.processRequest(this.proposalApi.approve(sc), 'Approved.', finish).subscribe((val: any) => {
        // none.
      });
    });
  }

  public async reject(): Promise<void> {
    if (!this.proposalData.proposal$.value?.uid) {
      return;
    }

    await this.auth.sign({
      uid: this.proposalData.proposal$.value.uid
    }, (sc, finish) => {
      this.notification.processRequest(this.proposalApi.reject(sc), 'Rejected.', finish).subscribe((val: any) => {
        // none.
      });
    });
  }

  public exportNativeEvent(): void {
    const proposal: Proposal|undefined = this.proposalData.proposal$.value;
    if (!proposal) {
      return;
    }

    const obj: any = {
        name: proposal.name,
        additionalInfo: proposal.additionalInfo || '',
        milestoneIndexCommence: proposal.settings.milestoneIndexCommence,
        milestoneIndexStart: proposal.settings.milestoneIndexStart,
        milestoneIndexEnd: proposal.settings.milestoneIndexEnd,
        payload: {
            type: 0,
            questions: proposal.questions
        }
    };
    const id = proposal.eventId || 'proposal';
    const link: any = document.createElement("a");
    link.download = id + '.json';
    const data: string = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj));
    link.href = "data:" + data;
    link.click();
  }

  private cancelSubscriptions(): void {
    this.currentMemberVotedTransSubscription$?.unsubscribe();
    this.canVoteSubscription$?.unsubscribe();
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
    this.cancelSubscriptions();
    this.proposalData.resetSubjects();
    this.guardiansSubscription$?.unsubscribe();
  }
}
