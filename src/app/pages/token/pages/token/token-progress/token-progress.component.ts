import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Token, TokenDistribution, TokenStatus } from '@functions/interfaces/models/token';
import { DataService } from '@pages/token/services/data.service';
import dayjs from 'dayjs';

@Component({
  selector: 'wen-token-progress',
  templateUrl: './token-progress.component.html',
  styleUrls: ['./token-progress.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenProgressComponent {
  @Input() token?: Token;
  @Input() memberDistribution?: TokenDistribution;
  constructor(
    public data: DataService
  ) {}

  public getCountdownDate(): Date {
    return dayjs(this.token?.saleStartDate?.toDate()).add(this.token?.saleLength || 0, 'ms').toDate();
  }

  public getCountdownTitle(): string {
    return $localize`Sale ends in`;
  }

  public isPreMinted(): boolean {
    return this.token?.status === TokenStatus.PRE_MINTED;
  }

  public getCountdownStartDate(): Date {
    return dayjs(this.token?.saleStartDate?.toDate()).toDate();
  }

  public getCountdownCooldownDate(): Date {
    return dayjs(this.token?.coolDownEnd?.toDate()).toDate();
  }

  public getInProgressTitle(): string {
    if (this.data.isInCooldown(this.token)) {
      return $localize`Cooldown in progress`;
    } else {
      return $localize`Sale in progress`;
    }
  }

  public getCountdownTitleStart(): string {
    return $localize`Sale starts in`;
  }

  public getCountdownCoolDownTitleStart(): string {
    return $localize`Cooldown ends in`;
  }


  public getPublicSaleSupply(): number {
    let sup = 0;
    this.token?.allocations.forEach((b) => {
      if (b.isPublicSale) {
        sup = b.percentage / 100;
      }
    });

    return (this.token?.totalSupply || 0) * sup;
  }

  public getPotentialTokens(): number {
    if (!this.memberDistribution?.totalDeposit) {
      return 0;
    }

    return ((this.memberDistribution?.totalDeposit || 0) / (this.token?.pricePerToken || 0));
  }

  public getTotalPotentialTokens(): number {
    if (!this.token?.totalDeposit) {
      return 0;
    }

    return ((this.token?.totalDeposit || 0) / (this.token?.pricePerToken || 0));
  }

  public getPrc(): number {
    const prc = ((this.token?.totalDeposit || 0) / (this.token?.pricePerToken || 0) / this.getPublicSaleSupply());
    return (prc > 1 ? 1 : prc) * 100;
  }
}
