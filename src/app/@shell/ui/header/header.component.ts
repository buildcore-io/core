import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { CollectionApi } from '@api/collection.api';
import { NftApi } from '@api/nft.api';
import { OrderApi } from '@api/order.api';
import { AuthService } from '@components/auth/services/auth.service';
import { CheckoutService } from '@core/services/checkout';
import { DeviceService } from '@core/services/device';
import { RouterService } from '@core/services/router';
import { getItem, removeItem, StorageItem } from '@core/utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as dayjs from 'dayjs';
import { BADGE_TO_CREATE_COLLECTION } from 'functions/interfaces/config';
import { Collection, TransactionOrder, TRANSACTION_AUTO_EXPIRY_MS } from 'functions/interfaces/models';
import { Nft } from 'functions/interfaces/models/nft';
import { NzNotificationRef, NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, debounceTime, firstValueFrom, fromEvent, interval, skip, Subscription } from 'rxjs';
import { FILE_SIZES } from "./../../../../../functions/interfaces/models/base";
import { Member } from './../../../../../functions/interfaces/models/member';
import { MemberApi } from './../../../@api/member.api';

const IS_SCROLLED_HEIGHT = 20;

@UntilDestroy()
@Component({
  selector: 'wen-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent implements OnInit {
  @ViewChild('notCompletedNotification', { static: false }) notCompletedNotification!: TemplateRef<any>;
  @ViewChild('emptyIcon', { static: false }) emptyIcon!: TemplateRef<any>;

  public path = ROUTER_UTILS.config.base;
  public enableCreateAwardProposal = false;
  public enableCollection = false;
  public accessSubscriptions$: Subscription[] = [];
  public isMemberProfile = false;
  public isLandingPage = false;
  public isAllowedCreation = false;
  public isMobileMenuVisible = false;
  public isScrolled = false;
  public isCheckoutOpen = false;
  public currentCheckoutNft?: Nft;
  public currentCheckoutCollection?: Collection;
  private notificationRef?: NzNotificationRef;
  public expiryTicker$: BehaviorSubject<dayjs.Dayjs|null> = new BehaviorSubject<dayjs.Dayjs|null>(null);
  private transaction$: BehaviorSubject<TransactionOrder|undefined> = new BehaviorSubject<TransactionOrder|undefined>(undefined);
  private subscriptionTransaction$?: Subscription;
  constructor(
    private router: Router,
    private memberApi: MemberApi,
    private orderApi: OrderApi,
    private nftApi: NftApi,
    private collectionApi: CollectionApi,
    private cd: ChangeDetectorRef,
    private nzNotification: NzNotificationService,
    private checkoutService: CheckoutService,
    public auth: AuthService,
    public deviceService: DeviceService,
    public routerService: RouterService
  ) { }

  public ngOnInit(): void {
    this.member$.pipe(
      untilDestroyed(this)
    ).subscribe(async (obj) => {
      if (obj?.uid) {
        this.cancelAccessSubscriptions();
        this.accessSubscriptions$.push(this.memberApi.topSpaces(obj.uid, 'createdOn', undefined, 1).subscribe((space) => {
          this.enableCreateAwardProposal = space.length > 0;
          this.cd.markForCheck();
        }));

        this.accessSubscriptions$.push(this.memberApi.topBadges(obj.uid, 'createdOn', undefined, 1).subscribe((badge) => {
          this.isAllowedCreation = badge.length > 0;
          this.cd.markForCheck();
        }));

        this.accessSubscriptions$.push(this.memberApi.hasBadge(obj.uid, BADGE_TO_CREATE_COLLECTION).subscribe((bol) => {
          this.enableCollection = bol;
          this.cd.markForCheck();
        }));
      } else {
        this.enableCreateAwardProposal = false;
        this.cd.markForCheck();
      }
    });

    const memberRoute = `/${ROUTER_UTILS.config.member.root}/`
    const landingPageRoute = `/${ROUTER_UTILS.config.base.home}`

    this.router.events.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (obj instanceof NavigationStart) {
        const previousIsMemberProfile = this.isMemberProfile;
        const previousIsLandingPage = this.isLandingPage;

        this.isMemberProfile = Boolean(obj.url?.startsWith(memberRoute))
        this.isLandingPage = Boolean(obj.url === landingPageRoute)

        if (previousIsMemberProfile !== this.isMemberProfile || previousIsLandingPage || this.isLandingPage) {
          this.cd.markForCheck();
        }
      }
    });

    // Monitor scroll.
    fromEvent(window, 'scroll').pipe(debounceTime(50), untilDestroyed(this)).subscribe(this.onScroll.bind(this));

    this.transaction$.pipe(skip(1), untilDestroyed(this)).subscribe((o) => {
      let expired = false;
      if (o) {
        const expiresOn: dayjs.Dayjs = dayjs(o.createdOn!.toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
        this.expiryTicker$.next(expiresOn);
        if (expiresOn.isBefore(dayjs())) {
          expired = true;
        }
      }

      if (expired === false && o?.payload.void === false && o?.payload.reconciled === false) {
        if (!this.notificationRef) {
          this.notificationRef = this.nzNotification.template(this.notCompletedNotification, {
            nzDuration: 0,
            nzCloseIcon: this.emptyIcon
          });
        }
      } else {
        this.removeCheckoutNotification();
      }
    });

    // Check periodically if there is something in the checkout.
    interval(500).pipe(untilDestroyed(this)).subscribe(() => {
      if (this.checkoutService.modalOpen$.value) {
        this.removeCheckoutNotification(false);
      } else {
        if (getItem(StorageItem.CheckoutTransaction) && (!this.subscriptionTransaction$ || this.subscriptionTransaction$.closed)) {
          this.subscriptionTransaction$ = this.orderApi.listen(<any>getItem(StorageItem.CheckoutTransaction)).pipe(untilDestroyed(this)).subscribe(<any>this.transaction$);
        }
      }
    });

    const int: Subscription = interval(1000).pipe(untilDestroyed(this)).subscribe(() => {
      this.expiryTicker$.next(this.expiryTicker$.value);

      // If it's in the past.
      if (this.expiryTicker$.value && this.expiryTicker$.value.isBefore(dayjs())) {
        this.expiryTicker$.next(null);
        int.unsubscribe();
        this.removeCheckoutNotification();
      }
    });
  }

  public async onOpenCheckout(): Promise<void> {
    const t = this.transaction$.getValue();
    if (!t?.payload.nft || !t?.payload.collection) {
      return;
    }

    let nft: Nft | undefined = await firstValueFrom(this.nftApi.listen(t?.payload.nft));
    const collection: Collection | undefined = await firstValueFrom(this.collectionApi.listen(t?.payload.collection));
    if (collection?.placeholderNft) {
      nft = await firstValueFrom(this.nftApi.listen(collection.placeholderNft));
    }
    if (nft && collection) {
      this.currentCheckoutCollection = collection;
      this.currentCheckoutNft = nft;
      this.isCheckoutOpen = true;
      this.cd.markForCheck();
    }
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }

  public get member$(): BehaviorSubject<Member | undefined> {
    return this.auth.member$;
  }

  public get urlToDiscover(): string {
    return '/' + ROUTER_UTILS.config.discover.root;
  }

  public closeCheckout(): void {
    this.checkoutService.modalOpen$.next(false);
    this.isCheckoutOpen = false;
  }
  public goToMyProfile(): void {
    if (this.member$.value?.uid) {
      this.router.navigate([ROUTER_UTILS.config.member.root, this.member$.value.uid]);
    }
  }

  private onScroll(): void {
    this.isScrolled = window.scrollY > IS_SCROLLED_HEIGHT;
    this.cd.markForCheck();
  }

  private removeCheckoutNotification(removeFromStorage = true): void {
    if (this.notificationRef) {
      this.nzNotification.remove(this.notificationRef.messageId);
      this.notificationRef = undefined;
    }

    this.subscriptionTransaction$?.unsubscribe();
    if (removeFromStorage) {
      this.currentCheckoutNft = undefined;
      this.currentCheckoutCollection = undefined;
      removeItem(StorageItem.CheckoutTransaction);
    }
  }

  public cancelAccessSubscriptions(): void {
    this.accessSubscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelAccessSubscriptions();
    this.subscriptionTransaction$?.unsubscribe();
    this.currentCheckoutNft = undefined;
    this.currentCheckoutCollection = undefined;
  }
}
