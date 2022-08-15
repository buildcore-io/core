import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { TokenApi } from '@api/token.api';
import { FavouritesIconComponent } from '@components/icon/favourites/favourites.component';
import { TabSection } from '@components/tabs/tabs.component';
import { getItem, setItem, StorageItem } from '@core/utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { WEN_NAME } from '@functions/interfaces/config';
import { Token } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter } from 'rxjs';

export const tokensSections: TabSection[] = [
  { route: `../${ROUTER_UTILS.config.tokens.favourites}`, label: $localize`Favourites`, icon: FavouritesIconComponent },
  { route: `../${ROUTER_UTILS.config.tokens.allTokens}`, label: $localize`All tokens` },
  { route: `../${ROUTER_UTILS.config.tokens.tradingPairs}`, label: $localize`Trading pairs` },
  { route: `../${ROUTER_UTILS.config.tokens.launchpad}`, label: $localize`Launchpad` }
];

const HIGHLIGHT_TOKENS = [
  '0x4067ee05ec37ec2e3b135384a0a8cb0db1010af0',
  '0x7eff2c7271851418f792daffe688e662a658950d'
];

@UntilDestroy()
@Component({
  selector: 'wen-tokens',
  templateUrl: './tokens.page.html',
  styleUrls: ['./tokens.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokensPage implements OnInit, OnDestroy {
  public isMigrationWarningVisible = false;
  public highlightTokens: Token[] = [];
  public recentlyListedTokens: Token[] = [];

  constructor(
    private titleService: Title,
    private tokenApi: TokenApi,
    private cd: ChangeDetectorRef,
    private router: Router
  ) {}

  public ngOnInit(): void {
    this.titleService.setTitle(WEN_NAME + ' - ' + 'Tokens');

    this.handleMigrationWarning();
    this.listenToHighlightTokens();
    this.listenToRecentlyListedTokens();
    
    if ((getItem(StorageItem.FavouriteTokens) as string[] || [])?.length && this.router.url.split('/').length === 2) {
      this.router.navigate(['/', ROUTER_UTILS.config.tokens.root, ROUTER_UTILS.config.tokens.favourites]);
    } else {
      this.router.navigate(['/', ROUTER_UTILS.config.tokens.root, ROUTER_UTILS.config.tokens.allTokens]);
    }
  }

  public understandMigrationWarning(): void {
    setItem(StorageItem.TokenMigrationWarningClosed, true);
    this.isMigrationWarningVisible = false;
  }

  private handleMigrationWarning(): void {
    const migrationWarningClosed = getItem(StorageItem.TokenMigrationWarningClosed);
    if (!migrationWarningClosed) {
      this.isMigrationWarningVisible = true;
    }
  }

  private listenToHighlightTokens(): void {
    this.tokenApi.listenMultiple(HIGHLIGHT_TOKENS)
      .pipe(
        filter(r => r.every(token => token)),
        untilDestroyed(this)
      )
      .subscribe(r => {
        this.highlightTokens = r as Token[];
        this.cd.markForCheck();
      });
  }

  private listenToRecentlyListedTokens(): void {
    this.tokenApi.top(undefined, undefined, 2)
      .pipe(untilDestroyed(this))
      .subscribe(r => {
        this.recentlyListedTokens = r;
        this.cd.markForCheck();
      });
  }

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
  }
}
