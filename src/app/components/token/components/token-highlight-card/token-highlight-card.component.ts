import { ChangeDetectionStrategy, Component, Input, OnDestroy } from '@angular/core';
import { TokenPurchaseApi } from '@api/token_purchase.api';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsService } from '@core/services/units';
import { Token } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Subscription } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-token-highlight-card',
  templateUrl: './token-highlight-card.component.html',
  styleUrls: ['./token-highlight-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenHighlightCardComponent implements OnDestroy {
  @Input() title = '';
  @Input() 
  set tokens(value: Token[]) {
    this._tokens = value;
    this.listenToStats();
  }
  get tokens(): Token[] {
    return this._tokens;
  }

  public listenAvgPrice24h: BehaviorSubject<number | undefined>[] = [];
  public listenChangePrice24h: BehaviorSubject<number | undefined>[] = [];

  private _tokens: Token[] = [];
  private subscriptions$: Subscription[] = [];

  constructor(
    public previewImageService: PreviewImageService,
    public unitsService: UnitsService,
    private tokenPurchaseApi: TokenPurchaseApi
  ) {}
  
  private listenToStats(): void {
    this.cancelSubscriptions();
    this.listenAvgPrice24h = [];
    this.listenChangePrice24h = [];
    this.tokens.forEach((token) => {
      const listenAvgPrice24h$ = new BehaviorSubject<number | undefined>(undefined);
      const listenChangePrice24h$ = new BehaviorSubject<number | undefined>(undefined);
      this.listenAvgPrice24h.push(listenAvgPrice24h$);
      this.listenChangePrice24h.push(listenChangePrice24h$);
      this.subscriptions$.push(this.tokenPurchaseApi.listenAvgPrice24h(token?.uid).pipe(untilDestroyed(this)).subscribe(listenAvgPrice24h$));
      this.subscriptions$.push(this.tokenPurchaseApi.listenChangePrice24h(token?.uid).pipe(untilDestroyed(this)).subscribe(listenChangePrice24h$));
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
