import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FULL_LIST } from '@api/base.api';
import { SpaceApi } from '@api/space.api';
import { AlgoliaService } from '@components/algolia/services/algolia.service';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { SeoService } from '@core/services/seo';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { environment } from '@env/environment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
  Award,
  COL,
  Milestone,
  ProposalStartDateMin,
  ProposalSubType,
  ProposalType,
  Space,
  TIME_GAP_BETWEEN_MILESTONES,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { NzDatePickerComponent } from 'ng-zorro-antd/date-picker';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzSelectOptionInterface } from 'ng-zorro-antd/select';
import { BehaviorSubject, filter, from, map, skip, Subscription, switchMap } from 'rxjs';
import { AwardApi } from './../../../../@api/award.api';
import { MemberApi } from './../../../../@api/member.api';
import { MilestoneApi } from './../../../../@api/milestone.api';
import { ProposalApi } from './../../../../@api/proposal.api';
import { NavigationService } from './../../../../@core/services/navigation/navigation.service';
import { NotificationService } from './../../../../@core/services/notification/notification.service';

enum TargetGroup {
  GUARDIANS = 0,
  MEMBERS = 1,
  NATIVE = 2,
}

@UntilDestroy()
@Component({
  selector: 'wen-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewPage implements OnInit, OnDestroy {
  public spaceControl: FormControl = new FormControl('', Validators.required);
  public nameControl: FormControl = new FormControl('', Validators.required);
  public selectedGroupControl: FormControl = new FormControl(
    TargetGroup.GUARDIANS,
    Validators.required,
  );
  public startControl: FormControl = new FormControl('', Validators.required);
  public endControl: FormControl = new FormControl('', Validators.required);
  public milestoneIndexCommenceControl: FormControl = new FormControl();
  public milestoneIndexStartControl: FormControl = new FormControl();
  public milestoneIndexEndControl: FormControl = new FormControl();
  public typeControl: FormControl = new FormControl(ProposalType.MEMBERS, Validators.required);
  public subTypeControl: FormControl = new FormControl(
    ProposalSubType.ONE_MEMBER_ONE_VOTE,
    Validators.required,
  );
  public votingAwardControl: FormControl = new FormControl([]);
  public additionalInfoControl: FormControl = new FormControl('', Validators.required);
  public defaultMinWeight: FormControl = new FormControl(0);
  public subTypes = ProposalSubType;
  // Questions / answers.
  public questions: FormArray;
  public proposalForm: FormGroup;
  @ViewChild('endDatePicker') public endDatePicker!: NzDatePickerComponent;
  public spaces$: BehaviorSubject<Space[]> = new BehaviorSubject<Space[]>([]);
  public awards$: BehaviorSubject<Award[] | undefined> = new BehaviorSubject<Award[] | undefined>(
    undefined,
  );
  public lastMilestone$: BehaviorSubject<Milestone | undefined> = new BehaviorSubject<
    Milestone | undefined
  >(undefined);
  private subscriptions$: Subscription[] = [];
  private subscriptionsAwards$?: Subscription;
  private answersIndex = 0;
  public filteredAwards$: BehaviorSubject<NzSelectOptionInterface[]> = new BehaviorSubject<
    NzSelectOptionInterface[]
  >([]);
  private awardsSubscription?: Subscription;

  constructor(
    private auth: AuthService,
    private proposalApi: ProposalApi,
    private notification: NotificationService,
    private memberApi: MemberApi,
    private awardApi: AwardApi,
    private route: ActivatedRoute,
    private milestoneApi: MilestoneApi,
    private router: Router,
    private nzNotification: NzNotificationService,
    private seo: SeoService,
    private spaceApi: SpaceApi,
    public nav: NavigationService,
    public readonly algoliaService: AlgoliaService,
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
  ) {
    this.questions = new FormArray([this.getQuestionForm()]);

    this.proposalForm = new FormGroup({
      space: this.spaceControl,
      type: this.typeControl,
      subType: this.subTypeControl,
      name: this.nameControl,
      group: this.selectedGroupControl,
      start: this.startControl,
      end: this.endControl,
      milestoneIndexCommence: this.milestoneIndexCommenceControl,
      milestoneIndexStart: this.milestoneIndexStartControl,
      milestoneIndexEnd: this.milestoneIndexEndControl,
      additionalInfo: this.additionalInfoControl,
      questions: this.questions,
      awards: this.votingAwardControl,
      defaultMinWeight: this.defaultMinWeight,
    });
  }

  public ngOnInit(): void {
    if (
      this.nav.getLastUrl() &&
      this.nav.getLastUrl()[1] === ROUTER_UTILS.config.space.root &&
      this.nav.getLastUrl()[2]
    ) {
      this.spaceControl.setValue(this.nav.getLastUrl()[2]);
    }

    this.seo.setTags(
      $localize`Proposal - New`,
      $localize`Create and vote on proposals that help shape the future of DAOs and the metaverse. Instant 1-click set up. Join today.`,
    );

    this.route.params
      ?.pipe(
        filter((p) => p.space),
        switchMap((p) => this.spaceApi.listen(p.space)),
        filter((space) => !!space),
        untilDestroyed(this),
      )
      .subscribe((space) => {
        this.spaceControl.setValue(space?.uid);

        this.seo.setTags(
          $localize`Proposal - New`,
          $localize`Create and vote on proposals that help shape the future of DAOs and the metaverse. Instant 1-click set up. Join today.`,
          space?.bannerUrl,
        );
      });

    this.auth.member$?.pipe(untilDestroyed(this)).subscribe((o) => {
      if (o?.uid) {
        this.subscriptions$.push(this.memberApi.allSpacesAsMember(o.uid).subscribe(this.spaces$));
        // TODO Implement paging.
        this.subscriptions$.push(this.awardApi.top(undefined, FULL_LIST).subscribe(this.awards$));
      }
    });

    this.selectedGroupControl.valueChanges.pipe(untilDestroyed(this)).subscribe((val) => {
      this.startControl.setValidators(val === TargetGroup.NATIVE ? [] : [Validators.required]);
      this.endControl.setValidators(val === TargetGroup.NATIVE ? [] : [Validators.required]);
      this.milestoneIndexCommenceControl.setValidators(
        val === TargetGroup.NATIVE ? [Validators.required] : [],
      );
      this.milestoneIndexStartControl.setValidators(
        val === TargetGroup.NATIVE ? [Validators.required] : [],
      );
      this.milestoneIndexEndControl.setValidators(
        val === TargetGroup.NATIVE ? [Validators.required] : [],
      );
      this.startControl.updateValueAndValidity();
      this.endControl.updateValueAndValidity();
      this.milestoneIndexCommenceControl.updateValueAndValidity();
      this.milestoneIndexStartControl.updateValueAndValidity();
      this.milestoneIndexEndControl.updateValueAndValidity();
    });

    this.lastMilestone$.pipe(untilDestroyed(this), skip(1)).subscribe((val) => {
      if (
        !this.milestoneIndexCommenceControl.value ||
        (val?.cmi && this.milestoneIndexCommenceControl.value < val.cmi)
      ) {
        this.milestoneIndexCommenceControl.setValue(val?.cmi || 0);
      }
    });

    this.milestoneApi
      .top(undefined, 1)
      ?.pipe(
        untilDestroyed(this),
        map((o: Milestone[]) => {
          return o[0];
        }),
      )
      .subscribe(this.lastMilestone$);
  }

  private getAnswerForm(): FormGroup {
    this.answersIndex++;
    return new FormGroup({
      value: new FormControl(this.answersIndex, [
        Validators.min(0),
        Validators.max(255),
        Validators.required,
      ]),
      text: new FormControl('', Validators.required),
      additionalInfo: new FormControl(''),
    });
  }

  public trackByUid(index: number, item: Award | Space) {
    return item.uid;
  }

  private getQuestionForm(): FormGroup {
    return new FormGroup({
      text: new FormControl('', Validators.required),
      additionalInfo: new FormControl(''),
      answers: new FormArray([this.getAnswerForm(), this.getAnswerForm()]),
    });
  }

  private subscribeAwardList(search?: string): void {
    this.awardsSubscription?.unsubscribe();
    this.awardsSubscription = from(
      this.algoliaService.searchClient
        .initIndex(COL.AWARD)
        .search(search || '', { length: 5, offset: 0 }),
    ).subscribe((r) => {
      this.filteredAwards$.next(
        r.hits.map((r) => {
          const award = r as unknown as Award;
          return {
            label: this.getAwardLabel(award),
            value: award.uid,
          };
        }),
      );
    });
  }

  public searchAward(v: string): void {
    if (v) {
      this.subscribeAwardList(v);
    }
  }

  public get targetGroups(): typeof TargetGroup {
    return TargetGroup;
  }

  public getDateBasedOnMilestone(milestoneValue: number): Date | undefined {
    if (!this.lastMilestone$.value || !this.lastMilestone$.value.cmi) {
      return undefined;
    }

    // In seconds.
    const diff: number =
      (milestoneValue - this.lastMilestone$.value.cmi) * TIME_GAP_BETWEEN_MILESTONES;
    return (diff > 0 ? dayjs().add(diff, 'seconds') : dayjs().subtract(diff, 'seconds')).toDate();
  }

  public gForm(f: any, value: string): any {
    return f.get(value);
  }

  public getAnswers(question: any): any {
    return question.controls.answers.controls;
  }

  public addAnswer(f: any): void {
    f.controls.answers.push(this.getAnswerForm());
  }

  public removeAnswer(f: any, answerIndex: number): void {
    if (f.controls.answers.length > 2) {
      this.answersIndex--;
      f.controls.answers.removeAt(answerIndex);
    }
  }

  public addQuestion(): void {
    this.questions.push(this.getQuestionForm());
  }

  public removeQuestion(questionIndex: number): void {
    if (this.questions.controls.length > 1) {
      this.questions.removeAt(questionIndex);
    }
  }

  public disabledStartDate(startValue: Date): boolean {
    // Disable past dates & today + 1day startValue
    if (startValue.getTime() < Date.now() - 60 * 60 * 1000 * 24) {
      return true;
    }

    if (!startValue || !this.endControl.value) {
      return false;
    }

    return startValue.getTime() > this.endControl.value.getTime();
  }

  public disabledEndDate(endValue: Date): boolean {
    if (endValue.getTime() < Date.now() - 60 * 60 * 1000 * 24) {
      return true;
    }

    if (!endValue || !this.startControl.value) {
      return false;
    }
    return endValue.getTime() <= this.startControl.value.getTime();
  }

  public handleStartOpenChange(open: boolean): void {
    if (!open) {
      this.endDatePicker.open();
    }
  }

  private formatSubmitObj(obj: any) {
    if (obj.group !== TargetGroup.NATIVE) {
      obj.settings = {
        startDate: obj.start,
        endDate: obj.end,
        onlyGuardians: !!(obj.group === TargetGroup.GUARDIANS),
        awards: obj.awards,
      };

      if (obj.defaultMinWeight > 0) {
        obj.settings.defaultMinWeight = obj.defaultMinWeight;
      }

      if (!obj.settings.awards?.length) {
        delete obj.settings.awards;
      }
    } else {
      // TODO We need to find right milestone.
      obj.settings = {
        milestoneIndexCommence: obj.milestoneIndexCommence,
        milestoneIndexStart: obj.milestoneIndexStart,
        milestoneIndexEnd: obj.milestoneIndexEnd,
      };

      // These are hardcoded for NATIVE.
      obj.type = ProposalType.NATIVE;
      obj.subType = ProposalSubType.ONE_ADDRESS_ONE_VOTE;
    }

    delete obj.milestoneIndexCommence;
    delete obj.milestoneIndexStart;
    delete obj.milestoneIndexEnd;
    delete obj.awards;
    delete obj.start;
    delete obj.end;
    delete obj.group;
    delete obj.defaultMinWeight;
    return obj;
  }

  private validateControls(controls: { [key: string]: AbstractControl }): void {
    Object.values(controls).forEach((control) => {
      if (control.invalid) {
        control.markAsDirty();
        control.updateValueAndValidity({ onlySelf: true });
      }
    });
  }

  private validateForm(): boolean {
    this.proposalForm.updateValueAndValidity();
    if (!this.proposalForm.valid) {
      this.validateControls(this.proposalForm.controls);
      return false;
    }

    return true;
  }

  public get isProd(): boolean {
    return environment.production;
  }

  public async create(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    if (dayjs(this.startControl.value).isBefore(dayjs().add(ProposalStartDateMin.value, 'ms'))) {
      this.nzNotification.error(
        '',
        'Start Date must be ' + ProposalStartDateMin.value / 60 / 1000 + ' minutes in future.',
      );
      return;
    }

    await this.auth.sign(this.formatSubmitObj(this.proposalForm.value), (sc, finish) => {
      this.notification
        .processRequest(this.proposalApi.create(sc), 'Created.', finish)
        .subscribe((val: any) => {
          this.router.navigate([ROUTER_UTILS.config.proposal.root, val?.uid]);
        });
    });
  }

  public getAnswerTitle(index: number): string {
    return $localize`Choice` + ` #${index >= 10 ? index : '0' + index}`;
  }

  public getAwardLabel(award: Award): string {
    return (
      award.name +
      ' (' +
      $localize`badge` +
      ': ' +
      award.badge.name +
      ', ' +
      $localize`id` +
      ': ' +
      award.uid.substring(0, 10) +
      ')'
    );
  }

  private cancelSubscriptions(): void {
    this.awardsSubscription?.unsubscribe();
    this.subscriptionsAwards$?.unsubscribe();
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
