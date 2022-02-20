import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, Router } from '@angular/router';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, first, skip, Subscription } from 'rxjs';
import { Award } from '../../../../../../functions/interfaces/models';
import { FILE_SIZES } from "../../../../../../functions/interfaces/models/base";
import { WEN_NAME } from './../../../../../../functions/interfaces/config';
import { AwardApi } from './../../../../@api/award.api';
import { SpaceApi } from './../../../../@api/space.api';
import { NavigationService } from './../../../../@core/services/navigation/navigation.service';
import { NotificationService } from './../../../../@core/services/notification/notification.service';
import { AuthService } from './../../../../components/auth/services/auth.service';
import { DataService } from './../../services/data.service';

@UntilDestroy()
@Component({
  selector: 'wen-award',
  templateUrl: './award.page.html',
  styleUrls: ['./award.page.less']
})
export class AwardPage implements OnInit, OnDestroy {
  public sections = [
    { route: [ROUTER_UTILS.config.award.overview], label: 'Overview' },
    { route: [ROUTER_UTILS.config.award.participants], label: 'Participants' }
  ];
  public isSubmitParticipationModalVisible = false;
  public commentControl: FormControl = new FormControl('');
  public isAwardInfoVisible = false;
  private subscriptions$: Subscription[] = [];
  private memberSubscriptions$: Subscription[] = [];

  constructor(
    private titleService: Title,
    private auth: AuthService,
    private router: Router,
    private notification: NotificationService,
    private spaceApi: SpaceApi,
    private route: ActivatedRoute,
    private awardApi: AwardApi,
    public data: DataService,
    public previewImageService: PreviewImageService,
    public nav: NavigationService,
    public deviceService: DeviceService
  ) {
    // none.
  }

  public ngOnInit(): void {
    this.titleService.setTitle(WEN_NAME + ' - ' + 'Award');
    this.route.params.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.award.award.replace(':', '')];
      if (id) {
        this.listenToAward(id);
      } else {
        this.notFound();
      }
    });

    // If we're unable to find the space we take the user out as well.
    this.data.award$.pipe(skip(1), untilDestroyed(this)).subscribe((obj: Award|undefined) => {
      if (!obj) {
        this.notFound();
        return;
      }

      // Once we load proposal let's load guardians for the space.
      this.memberSubscriptions$.forEach((s) => {
        s.unsubscribe();
      });
      if (this.auth.member$.value?.uid) {
        this.memberSubscriptions$.push(this.spaceApi.isGuardianWithinSpace(obj.space, this.auth.member$.value.uid)
                                  .pipe(untilDestroyed(this)).subscribe(this.data.isGuardianWithinSpace$));

        this.memberSubscriptions$.push(this.awardApi.isMemberParticipant(obj.uid, this.auth.member$.value.uid)
                                  .pipe(untilDestroyed(this)).subscribe(this.data.isParticipantWithinAward$));

        this.memberSubscriptions$.push(this.spaceApi.isMemberWithinSpace(obj.space, this.auth.member$.value.uid)
                                  .pipe(untilDestroyed(this)).subscribe(this.data.isLoggedInMemberWithinSpace$));

      }
    });

    this.data.award$.pipe(skip(1), first()).subscribe((a) => {
      if (a) {
        this.subscriptions$.push(this.spaceApi.listen(a.space).pipe(untilDestroyed(this)).subscribe(this.data.space$));
      }
    });
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  private listenToAward(id: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.awardApi.listen(id).pipe(untilDestroyed(this)).subscribe(this.data.award$));
    this.subscriptions$.push(this.awardApi.listenOwners(id).pipe(untilDestroyed(this)).subscribe(this.data.owners$));
  }

  public showParticipateModal(): void {
    this.isSubmitParticipationModalVisible = true;
  }

  public handleParticipateCancel(): void {
    this.isSubmitParticipationModalVisible = false;
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public async approve(): Promise<void> {
    if (!this.data.award$.value?.uid) {
      return;
    }

    await this.auth.sign({
        uid: this.data.award$.value.uid
    }, (sc, finish) => {
      this.notification.processRequest(this.awardApi.approve(sc), 'Approved.', finish).subscribe((val: any) => {
        // none.
      });
    });
  }

  public async reject(): Promise<void> {
    if (!this.data.award$.value?.uid) {
      return;
    }

    await this.auth.sign({
      uid: this.data.award$.value.uid
    }, (sc, finish) => {
      this.notification.processRequest(this.awardApi.reject(sc), 'Rejected.', finish).subscribe((val: any) => {
        // none.
      });
    });

  }

  public async participate(): Promise<void> {
    this.isSubmitParticipationModalVisible = false;
    if (!this.data.award$.value?.uid) {
      return;
    }

    await this.auth.sign({
      uid: this.data.award$.value.uid,
      comment: this.commentControl.value || undefined
    }, (sc, finish) => {
      this.notification.processRequest(this.awardApi.participate(sc), 'Participated.', finish).subscribe(() => {
        // Let's reset form field back to empty.
        this.commentControl.setValue('');
      });
    });

  }

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
    this.cancelSubscriptions();
    this.data.resetSubjects();
    this.memberSubscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }
}
