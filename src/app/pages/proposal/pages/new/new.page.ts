import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as dayjs from 'dayjs';
import { NzDatePickerComponent } from 'ng-zorro-antd/date-picker';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, Subscription } from 'rxjs';
import { PROPOSAL_START_DATE_MIN } from "./../../../../../../functions/interfaces/config";
import { Space } from './../../../../../../functions/interfaces/models';
import { ProposalType } from './../../../../../../functions/interfaces/models/proposal';
import { MemberApi } from './../../../../@api/member.api';
import { ProposalApi } from './../../../../@api/proposal.api';
import { NavigationService } from './../../../../@core/services/navigation/navigation.service';
import { NotificationService } from './../../../../@core/services/notification/notification.service';

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
  @ViewChild('endDatePicker') public endDatePicker!: NzDatePickerComponent;
  public spaces$: BehaviorSubject<Space[]> = new BehaviorSubject<Space[]>([]);
  private subscriptions$: Subscription[] = [];
  private answersIndex = 0;

  constructor(
    private auth: AuthService,
    private proposalApi: ProposalApi,
    private notification: NotificationService,
    private memberApi: MemberApi,
    private route: ActivatedRoute,
    private router: Router,
    private nzNotification: NzNotificationService,
    public nav: NavigationService
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
        this.subscriptions$.push(this.memberApi.allSpacesAsMember(o.uid).subscribe(this.spaces$));
      }
    });
  }

  private getAnswerForm(): FormGroup {
    this.answersIndex++;
    return new FormGroup({
      value: new FormControl(
        this.answersIndex,
        [Validators.min(0), Validators.max(255), Validators.required]
      ),
      text: new FormControl('', Validators.required),
      additionalInfo: new FormControl(''),
    });
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
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
    if (startValue.getTime() < (Date.now() - (60 * 60 * 1000 * 24))) {
      return true;
    }

    if (!startValue || !this.endControl.value) {
      return false;
    }

    return startValue.getTime() > this.endControl.value.getTime();
  };

  public disabledEndDate(endValue: Date): boolean {
    if (endValue.getTime() < (Date.now() - (60 * 60 * 1000 * 24))) {
      return true;
    }

    if (!endValue || !this.startControl.value) {
      return false;
    }
    return endValue.getTime() <= this.startControl.value.getTime();
  };

  public handleStartOpenChange(open: boolean): void {
    if (!open) {
      this.endDatePicker.open();
    }
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

  public async create(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    if (dayjs(this.startControl.value).isBefore(dayjs().add(PROPOSAL_START_DATE_MIN, 'ms'))) {
      this.nzNotification.error('', 'Start Date must be ' + (PROPOSAL_START_DATE_MIN / 60 / 1000) + ' minutes in future.');
      return;
    }

    await this.auth.sign(this.formatSubmitObj(this.proposalForm.value), (sc, finish) => {
      this.notification.processRequest(this.proposalApi.create(sc), 'Created.', finish).subscribe((val: any) => {
        this.router.navigate([ROUTER_UTILS.config.proposal.root, val?.uid])
      });
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
