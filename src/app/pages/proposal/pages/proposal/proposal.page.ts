import { Location } from "@angular/common";
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Proposal } from 'functions/interfaces/models';
import { BehaviorSubject, skip, Subscription } from 'rxjs';
import { WenRequest } from './../../../../../../functions/interfaces/models/base';
import { ProposalAnswer, ProposalMember, ProposalQuestion, ProposalType } from './../../../../../../functions/interfaces/models/proposal';
import { ProposalApi } from './../../../../@api/proposal.api';
import { SpaceApi } from './../../../../@api/space.api';
import { NotificationService } from './../../../../@core/services/notification/notification.service';
import { DataService } from './../../services/data.service';

// TODO default table content
interface Person {
  key: string;
  name: string;
  date: string;
  option: string;
  amount: number;
}

@UntilDestroy()
@Component({
  selector: 'wen-proposal',
  templateUrl: './proposal.page.html',
  styleUrls: ['./proposal.page.less']
})
export class ProposalPage implements OnInit, OnDestroy {
  public isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public voteControl: FormControl = new FormControl();
  private subscriptions$: Subscription[] = [];
  private guardiansSubscription$?: Subscription;

  constructor(
    private auth: AuthService,
    private location: Location,
    private router: Router,
    private notification: NotificationService,
    private spaceApi: SpaceApi,
    private route: ActivatedRoute,
    private proposalApi: ProposalApi,
    private cd: ChangeDetectorRef,
    public data: DataService
  ) {
    // none.
  }

  public ngOnInit(): void {
    this.route.params.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.proposal.proposal.replace(':', '')];
      if (id) {
        this.listenToProposal(id);
      } else {
        this.notFound();
      }
    });

    // If we're unable to find the space we take the user out as well.
    this.data.proposal$.pipe(skip(1)).subscribe((obj: Proposal|undefined) => {
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
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  private listenToProposal(id: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.proposalApi.listen(id).pipe(untilDestroyed(this)).subscribe(this.data.proposal$));
    this.subscriptions$.push(this.proposalApi.listenMembers(id).pipe(untilDestroyed(this)).subscribe(this.data.members$));
    this.subscriptions$.push(this.proposalApi.lastVotes(id).pipe(untilDestroyed(this)).subscribe(this.data.transactions$));
  }

  public memberIsPartOfVote(memberId: string): boolean {
    if (!this.data.guardians$.value) {
      return false;
    }

    return this.data.guardians$.value.filter(e => e.uid === memberId).length > 0;
  }

  public isMemberVote(type: ProposalType|undefined): boolean {
    return (type === ProposalType.MEMBERS);
  }

  public isNativeVote(type: ProposalType|undefined): boolean {
    return (type === ProposalType.NATIVE);
  }

  public getProgress(q: ProposalQuestion, a: ProposalAnswer, members?: ProposalMember[]|null): number {
    let calc = 0;
    members?.forEach((o) => {
      if (o.voted && o.values?.length && o.values?.length > 0 && o.values.includes(a.value)) {
        calc++;
      }
    });

    return  calc / (members?.length || 1) * 100;
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

  public canVote(members?: ProposalMember[]|null): boolean {
    if (!this.auth.member$?.value?.uid) {
      return false;
    }

    let canVote = undefined;
    members?.find((m) => {
      if (m.uid === this.auth.member$?.value?.uid) {
        canVote = !m.voted;
      }
    });


    return (canVote === true);
  }

  public goBack(): void {
    this.location.back();
  }

  public async approve(): Promise<void> {
    if (!this.data.proposal$.value?.uid) {
      return;
    }

    const sc: WenRequest|undefined =  await this.auth.sign({
        uid: this.data.proposal$.value.uid
    });

    this.notification.processRequest(this.proposalApi.approve(sc), 'Approved.').subscribe((val: any) => {
      // none.
    });
  }

  public async reject(): Promise<void> {
    if (!this.data.proposal$.value?.uid) {
      return;
    }

    const sc: WenRequest|undefined =  await this.auth.sign({
      uid: this.data.proposal$.value.uid
    });

    this.notification.processRequest(this.proposalApi.reject(sc), 'Rejected.').subscribe((val: any) => {
      // none.
    });
  }

  public async vote(): Promise<void> {
    if (!this.data.proposal$.value?.uid) {
      return;
    }

    const sc: WenRequest|undefined =  await this.auth.sign({
      uid: this.data.proposal$.value.uid,
      values: [this.voteControl.value]
    });

    this.notification.processRequest(this.proposalApi.vote(sc), 'Rejected.').subscribe((val: any) => {
      // none.
    });
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
    if (this.guardiansSubscription$) {
      this.guardiansSubscription$.unsubscribe();
    }
  }
}
