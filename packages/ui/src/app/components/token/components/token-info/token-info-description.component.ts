import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { TokenApi } from '@api/token.api';
import { DescriptionItemType } from '@components/description/description.component';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsService } from '@core/services/units';
import { download } from '@core/utils/tools.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/token/services/data.service';
import { HelperService } from '@pages/token/services/helper.service';
import { Token } from '@soonaverse/interfaces';
import Papa from 'papaparse';
import { debounceTime } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-token-info-description',
  templateUrl: './token-info-description.component.html',
  styleUrls: ['./token-info-description.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TokenInfoDescriptionComponent {
  @Input() token?: Token;

  public tokenInfoLabels: string[] = [
    $localize`Icon`,
    $localize`Name`,
    $localize`Symbol`,
    $localize`Launchpad Price`,
    $localize`Network`,
    $localize`Total supply`,
    $localize`Current distribution`,
    $localize`Type`,
  ];

  constructor(
    public data: DataService,
    public previewImageService: PreviewImageService,
    public helper: HelperService,
    public unitsService: UnitsService,
    private tokenApi: TokenApi,
    private cd: ChangeDetectorRef,
  ) {}

  public get descriptionItemTypes(): typeof DescriptionItemType {
    return DescriptionItemType;
  }

  public formatTokenBest(amount?: number | null): string {
    if (!amount) {
      return '0';
    }

    return (amount / 1000 / 1000).toFixed(2).toString();
  }

  public downloadCurrentDistribution(): void {
    this.tokenApi
      .getDistributions(this.token?.uid)
      .pipe(debounceTime(2500), untilDestroyed(this))
      .subscribe((distributions) => {
        const fields = [
          '',
          'ethAddress',
          'tokenOwned',
          'unclaimedTokens',
          'tokenClaimed',
          'lockedForSale',
          'sold',
          'totalBought',
          'refundedAmount',
          'totalPaid',
          'totalDeposit',
        ];
        const csv = Papa.unparse({
          fields,
          data:
            distributions?.map((d) => [
              d.uid,
              d.tokenOwned,
              <any>d.totalUnclaimedAirdrop || 0,
              d.tokenClaimed,
              d.lockedForSale,
              d.sold,
              d.totalBought,
              d.refundedAmount,
              d.totalPaid,
              d.totalDeposit,
            ]) || [],
        });

        download(
          `data:text/csv;charset=utf-8${csv}`,
          `soonaverse_${this.token?.symbol}_distribution.csv`,
        );
        this.cd.markForCheck();
      });
  }
}
