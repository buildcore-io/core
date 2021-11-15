import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Space } from "functions/interfaces/models";
import { BehaviorSubject, skip, Subscription } from 'rxjs';
import { Member } from './../../../../../../functions/interfaces/models/member';
import { SpaceApi } from './../../../../@api/space.api';

@UntilDestroy()
@Component({
  selector: 'wen-space',
  templateUrl: './space.page.html',
  styleUrls: ['./space.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpacePage implements OnInit, OnDestroy {
  public sections = [
    { route: 'overview', label: 'Overview' },
    { route: 'proposals', label: 'Proposals' },
    { route: 'awards', label: 'Awards' },
    { route: 'funding', label: 'Funding' },
    { route: 'members', label: 'Members' }
  ];
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public isMemberWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private subscriptions$: Subscription[] = [];

  constructor(
    private auth: AuthService,
    private spaceApi: SpaceApi,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // none.
  }

  public ngOnInit(): void {
    this.route.params.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.space.space.replace(':', '')];
      if (id) {
        this.listenToSpace(id);
      } else {
        this.notFound();
      }
    });

    // If we're unable to find the space we take the user out as well.
    this.space$.pipe(skip(1)).subscribe((obj) => {
      if (!obj) {
        this.notFound();
      }
    });
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  private listenToSpace(id: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.spaceApi.listen(id).pipe(untilDestroyed(this)).subscribe(this.space$));
    this.auth.member$.pipe(untilDestroyed(this)).subscribe((m?: Member) => {
      if (m?.uid) {
        this.listenToIsMemberAndGuardian(id, m.uid);
      }
    });
  }

  private listenToIsMemberAndGuardian(spaceId: string, memberId: string): void {
    this.subscriptions$.push(this.spaceApi.isMemberWithinSpace(spaceId, memberId).pipe(untilDestroyed(this)).subscribe(this.isMemberWithinSpace$));
    this.subscriptions$.push(this.spaceApi.isGuardianWithinSpace(spaceId, memberId).pipe(untilDestroyed(this)).subscribe(this.isGuardianWithinSpace$));
  }

  public get urlToSpaces(): string {
    return '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.spaces;
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
