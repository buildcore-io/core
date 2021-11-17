import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { undefinedToEmpty } from '@core/utils/manipulations.utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Space } from 'functions/interfaces/models';
import { NzDatePickerComponent } from 'ng-zorro-antd/date-picker';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, Subscription } from 'rxjs';
import { WenRequest } from './../../../../../../functions/interfaces/models/base';
import { ProposalType } from './../../../../../../functions/interfaces/models/proposal';
import { MemberApi } from './../../../../@api/member.api';
import { ProposalApi } from './../../../../@api/proposal.api';

@UntilDestroy()
@Component({
  selector: 'wen-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewPage implements OnInit, OnDestroy {
  public spaceControl: FormControl = new FormControl('', Validators.required);
  public nameControl: FormControl = new FormControl('', Validators.required);
  public selectedGroupControl: FormControl = new FormControl(true, Validators.required);
  public startControl: FormControl = new FormControl('', Validators.required);
  public endControl: FormControl = new FormControl('', Validators.required);
  public typeControl: FormControl = new FormControl(ProposalType.MEMBERS, Validators.required);
  public additionalInfoControl: FormControl = new FormControl('');
  // Questions / answers.
  public questions: FormArray;
  public proposalForm: FormGroup;
  public startValue?: Date;
  public endValue?: Date;
  @ViewChild('endDatePicker') public endDatePicker!: NzDatePickerComponent;
  public spaces$: BehaviorSubject<Space[]> = new BehaviorSubject<Space[]>([]);
  private subscriptions$: Subscription[] = [];

  constructor(
    private auth: AuthService,
    private proposalApi: ProposalApi,
    private notification: NzNotificationService,
    private memberApi: MemberApi,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.questions = new FormArray([
      this.getQuestionForm()
    ]);

    this.proposalForm = new FormGroup({
      space: this.spaceControl,
      type: this.typeControl,
      name: this.nameControl,
      group: this.selectedGroupControl,
      start: this.startControl,
      end: this.endControl,
      additionalInfo: this.additionalInfoControl,
      questions: this.questions
    });
  }

  public ngOnInit(): void {
    this.route.params.pipe(untilDestroyed(this)).subscribe((p) => {
      if (p.space) {
        this.spaceControl.setValue(p.space);
      }
    });

    this.auth.member$.pipe(untilDestroyed(this)).subscribe((o) => {
      if (o?.uid) {
        this.subscriptions$.push(this.memberApi.allSpacesWhereGuardian(o.uid).subscribe(this.spaces$));
      }
    });
  }

  private getAnswerForm(): FormGroup {
    return new FormGroup({
      value: new FormControl('', [Validators.min(0), Validators.max(255), Validators.required]),
      text: new FormControl('', Validators.required),
      additionalInfo: new FormControl(''),
    });
  }

  private getQuestionForm(): FormGroup {
    return new FormGroup({
      text: new FormControl('', Validators.required),
      additionalInfo: new FormControl(''),
      answers: new FormArray([
        this.getAnswerForm(),
        this.getAnswerForm()
      ])
    });
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
    if (!startValue || !this.endValue) {
      return false;
    }
    return startValue.getTime() > this.endValue.getTime();
  };

  public disabledEndDate(endValue: Date): boolean {
    if (!endValue || !this.startValue) {
      return false;
    }
    return endValue.getTime() <= this.startValue.getTime();
  };

  public handleStartOpenChange(open: boolean): void {
    if (!open) {
      this.endDatePicker.open();
    }
  }

  public get urlToSpaces(): string {
    return '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.proposals;
  }

  private formatSubmitObj(obj: any) {
    obj.settings = {
      startDate: obj.start,
      endDate: obj.end,
      onlyGuardians: obj.group
    };

    delete obj.start;
    delete obj.end;
    delete obj.group;
    return obj;
  }

  public async create(): Promise<void> {
    console.log(this.formatSubmitObj(this.proposalForm.value));
    this.proposalForm.updateValueAndValidity();
    if (!this.proposalForm.valid) {
      return;
    }

    const sc: WenRequest|undefined =  await this.auth.signWithMetamask(
      undefinedToEmpty(this.formatSubmitObj(this.proposalForm.value))
    );

    if (!sc) {
      throw new Error('Unable to sign.');
    }

    // TODO Handle this via queue and clean-up.
    this.proposalApi.create(sc).subscribe((val) => {
      this.notification.success('Created.', '');
      this.router.navigate([ROUTER_UTILS.config.space.root, val?.uid])
    });
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
