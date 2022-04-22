import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { TokenItemType } from '@components/token/components/token-claim-refund/token-claim-refund.component';
import { PreviewImageService } from '@core/services/preview-image';

@Component({
  selector: 'wen-tokens',
  templateUrl: './tokens.page.html',
  styleUrls: ['./tokens.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokensPage {
  public tokens = [
    { token: 'SoonLabs Token', amount: 500, value: 500, type: 'Refund' },
    { token: 'IOTABOTS Token', amount: 100, value: 100, type: 'Claim' }
  ];
  public openClaimRefundType: TokenItemType | null = null;

  constructor(
    public previewImageService: PreviewImageService,
    private cd: ChangeDetectorRef
  ) { }

  public get tokenItemTypes(): typeof TokenItemType {
    return TokenItemType;
  }

  public typeClick(type: string): void {
    this.openClaimRefundType = type === 'Refund' ? TokenItemType.REFUND : TokenItemType.CLAIM;
    console.log(this.openClaimRefundType);
    this.cd.markForCheck();
  }
}
