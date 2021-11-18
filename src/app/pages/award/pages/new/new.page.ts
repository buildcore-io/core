import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { undefinedToEmpty } from '@core/utils/manipulations.utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, Subscription } from 'rxjs';
import { AwardType } from './../../../../../../functions/interfaces/models/award';
import { WenRequest } from './../../../../../../functions/interfaces/models/base';
import { Space } from './../../../../../../functions/interfaces/models/space';
import { AwardApi } from './../../../../@api/award.api';
import { MemberApi } from './../../../../@api/member.api';
import { AuthService } from './../../../../components/auth/services/auth.service';

@UntilDestroy()
@Component({
  selector: 'wen-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.less']
})
export class NewPage implements OnInit, OnDestroy {
  public spaceControl: FormControl = new FormControl('', Validators.required);
  public typeControl: FormControl = new FormControl(AwardType.PARTICIPATE_AND_APPROVE, Validators.required);
  public nameControl: FormControl = new FormControl('', Validators.required);
  public endControl: FormControl = new FormControl('', Validators.required);
  public descriptionControl: FormControl = new FormControl('');
  // Badge
  public badgeDescriptionControl: FormControl = new FormControl('');
  public badgeNameControl: FormControl = new FormControl('', Validators.required);
  public badgeXpControl: FormControl = new FormControl('', [
    Validators.min(0),
    Validators.max(1000),
    Validators.required
  ]);
  public badgeCountControl: FormControl = new FormControl('', [
    Validators.min(0),
    Validators.max(1000),
    Validators.required
  ]);

  public types = AwardType;
  public awardForm: FormGroup;
  public spaces$: BehaviorSubject<Space[]> = new BehaviorSubject<Space[]>([]);
  private subscriptions$: Subscription[] = [];

  constructor(
    private auth: AuthService,
    private awardApi: AwardApi,
    private notification: NzNotificationService,
    private memberApi: MemberApi,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.awardForm = new FormGroup({
      space: this.spaceControl,
      type: this.typeControl,
      name: this.nameControl,
      endDate: this.endControl,
      description: this.descriptionControl,
      badgeDescription: this.badgeDescriptionControl,
      badgeName: this.badgeNameControl,
      badgeXp: this.badgeXpControl,
      badgeCount: this.badgeCountControl
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
        this.subscriptions$.push(this.memberApi.allSpacesWhereMember(o.uid).subscribe(this.spaces$));
      }
    });
  }

  public get urlToSpaces(): string {
    return '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.awards;
  }

  private formatSubmitObj(obj: any): any {
    obj.badge = {
      description: obj.badgeDescription,
      name: obj.badgeName,
      xp: obj.badgeXp,
      count: obj.badgeCount
    };

    delete obj.badgeDescription;
    delete obj.badgeName;
    delete obj.badgeXp;
    delete obj.badgeCount;
    return obj;
  }

  public async create(): Promise<void> {
    this.awardForm.updateValueAndValidity();
    if (!this.awardForm.valid) {
      return;
    }

    const sc: WenRequest|undefined =  await this.auth.signWithMetamask(
      undefinedToEmpty(this.formatSubmitObj(this.awardForm.value))
    );

    if (!sc) {
      throw new Error('Unable to sign.');
    }

    // TODO Handle this via queue and clean-up.
    this.awardApi.create(sc).subscribe((val) => {
      this.notification.success('Created.', '');
      this.router.navigate([ROUTER_UTILS.config.award.root, val?.uid])
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
