import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, Router } from '@angular/router';
import { AwardApi } from "@api/award.api";
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Proposal } from 'functions/interfaces/models';
import { BehaviorSubject, first, firstValueFrom, skip, Subscription } from 'rxjs';
import { WEN_NAME } from './../../../../../../functions/interfaces/config';
import { Award } from './../../../../../../functions/interfaces/models/award';
import { FILE_SIZES } from "./../../../../../../functions/interfaces/models/base";
import { ProposalQuestion, ProposalSubType } from './../../../../../../functions/interfaces/models/proposal';
import { FileApi } from './../../../../@api/file.api';
import { MemberApi } from './../../../../@api/member.api';
import { ProposalApi } from './../../../../@api/proposal.api';
import { SpaceApi } from './../../../../@api/space.api';
import { NavigationService } from './../../../../@core/services/navigation/navigation.service';
import { NotificationService } from './../../../../@core/services/notification/notification.service';
import { DataService } from './../../services/data.service';

@UntilDestroy()
@Component({
  selector: 'wen-proposal',
  templateUrl: './proposal.page.html',
  styleUrls: ['./proposal.page.less']
})
export class ProposalPage implements OnInit, OnDestroy {
  public sections = [
    { route: [ROUTER_UTILS.config.proposal.overview], label: 'Overview' },
    { route: [ROUTER_UTILS.config.proposal.participants], label: 'Participants' }
  ];
  public isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
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
    private cd: ChangeDetectorRef,
    public data: DataService,
    public nav: NavigationService
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
    this.data.proposal$.pipe(skip(1), untilDestroyed(this)).subscribe((obj: Proposal|undefined) => {
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
    });

    // Guardians might be refreshed alter and we need to apply that on view.
    this.data.guardians$.subscribe(() => {
      this.cd.markForCheck();
    });

    // Once we get proposal get space.
    this.data.proposal$.pipe(skip(1), first()).subscribe(async (p) => {
      if (p) {
        this.subscriptions$.push(this.spaceApi.listen(p.space).pipe(untilDestroyed(this)).subscribe(this.data.space$));
        if (p.createdBy) {
          this.subscriptions$.push(this.memberApi.listen(p.createdBy).pipe(untilDestroyed(this)).subscribe(this.data.creator$));
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

        this.data.badges$.next(awards);
      }
    });

    this.auth.member$.pipe(untilDestroyed(this)).subscribe((member) => {
      this.currentMemberVotedTransSubscription$?.unsubscribe();
      this.canVoteSubscription$?.unsubscribe();
      if (member?.uid && this.proposalId) {
        this.currentMemberVotedTransSubscription$ = this.proposalApi.getMembersVotes(this.proposalId, member.uid).subscribe(this.data.currentMembersVotes$);
        this.currentMemberVotedTransSubscription$ = this.proposalApi.canMemberVote(this.proposalId, member.uid).subscribe(this.data.canVote$);
      } else {
        this.data.currentMembersVotes$.next(undefined);
        this.data.canVote$.next(false);
      }
    });
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public getAvatarSize(url?: string|null): string|undefined {
    if (!url) {
      return undefined;
    }

    return FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small);
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  private listenToProposal(id: string): void {
    this.proposalId = id;
    this.cancelSubscriptions();
    this.subscriptions$.push(this.proposalApi.listen(id).pipe(untilDestroyed(this)).subscribe(this.data.proposal$));
    // TODO Fix paging.
    this.subscriptions$.push(this.proposalApi.listenMembers(id, undefined, 'createdOn', 'desc', 2500).pipe(untilDestroyed(this)).subscribe(this.data.members$));
    this.subscriptions$.push(this.proposalApi.lastVotes(id).pipe(untilDestroyed(this)).subscribe(this.data.transactions$));
  }

  public memberIsPartOfVote(memberId: string): boolean {
    if (!this.data.guardians$.value) {
      return false;
    }

    return this.data.guardians$.value.filter(e => e.uid === memberId).length > 0;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public getVotingTypeText(subType: ProposalSubType|undefined): string {
    if (subType === ProposalSubType.ONE_ADDRESS_ONE_VOTE) {
      return 'One Address One Vote';
    } else if (subType === ProposalSubType.ONE_MEMBER_ONE_VOTE) {
      return 'One Member One Vote';
    } else if (subType === ProposalSubType.REPUTATION_BASED_ON_SPACE) {
      return 'Reputation within Space';
    } else if (subType === ProposalSubType.REPUTATION_BASED_ON_AWARDS) {
      return 'Reputation within Badges';
    } else {
      return '';
    }
  }

  public findAnswerText(qs: ProposalQuestion[]|undefined, values: number[]): string {
    let text = '';
    qs?.forEach((q: ProposalQuestion) => {
      q.answers.forEach((a) => {
        if (values.includes(a.value)) {
          text = a.text;
        }
      });
    });

    return text;
  }

  public async approve(): Promise<void> {
    if (!this.data.proposal$.value?.uid) {
      return;
    }

    await this.auth.sign({
        uid: this.data.proposal$.value.uid
    }, (sc, finish) => {
      this.notification.processRequest(this.proposalApi.approve(sc), 'Approved.', finish).subscribe((val: any) => {
        // none.
      });
    });
  }

  public async reject(): Promise<void> {
    if (!this.data.proposal$.value?.uid) {
      return;
    }

    await this.auth.sign({
      uid: this.data.proposal$.value.uid
    }, (sc, finish) => {
      this.notification.processRequest(this.proposalApi.reject(sc), 'Rejected.', finish).subscribe((val: any) => {
        // none.
      });
    });

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
    this.data.resetSubjects();
    if (this.guardiansSubscription$) {
      this.guardiansSubscription$.unsubscribe();
    }
  }
}
