import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FileApi } from '@api/file.api';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FILE_SIZES } from "functions/interfaces/models/base";
import { BehaviorSubject, Subscription } from 'rxjs';
import { AwardType } from './../../../../../../functions/interfaces/models/award';
import { Space } from './../../../../../../functions/interfaces/models/space';
import { AwardApi } from './../../../../@api/award.api';
import { MemberApi } from './../../../../@api/member.api';
import { NavigationService } from './../../../../@core/services/navigation/navigation.service';
import { NotificationService } from './../../../../@core/services/notification/notification.service';
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
    private notification: NotificationService,
    private memberApi: MemberApi,
    private route: ActivatedRoute,
    private router: Router,
    public nav: NavigationService
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
    if (this.nav.getLastUrl() && this.nav.getLastUrl()[1] === ROUTER_UTILS.config.space.root && this.nav.getLastUrl()[2]) {
      this.spaceControl.setValue(this.nav.getLastUrl()[2]);
    }
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

  public trackByUid(index: number, item: any): number {
    return item.uid;
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

  private validateForm(): boolean {
    this.awardForm.updateValueAndValidity();
    if (!this.awardForm.valid) {
      Object.values(this.awardForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      return false;
    }

    return true;
  }

  public getAvatarSize(url?: string|null): string|undefined {
    if (!url) {
      return undefined;
    }

    return FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small);
  }

  public async create(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    await this.auth.sign(this.formatSubmitObj(this.awardForm.value), (sc, finish) => {
      this.notification.processRequest(this.awardApi.create(sc), 'Created.', finish).subscribe((val) => {
        this.router.navigate([ROUTER_UTILS.config.award.root, val?.uid])
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
