import { Injectable } from '@angular/core';
import { UnitsService } from '@core/services/units';
import { Network, Transaction, TransactionType, TRANSACTION_AUTO_EXPIRY_MS } from '@functions/interfaces/models';
import { Token, TokenDrop, TokenStatus } from '@functions/interfaces/models/token';
import * as dayjs from 'dayjs';
import * as duration from 'dayjs/plugin/duration';
dayjs.extend(duration)
@Injectable({
  providedIn: 'root'
})
export class HelperService {
  constructor(
    public unitsService: UnitsService
  ) { }

  public percentageMarketCap(percentage: number, token?: Token): string {
    if (!token) {
      return '';
    }
    return this.unitsService.format(Math.floor(token?.pricePerToken * (token?.totalSupply * percentage / 100)));
  }

  public formatTokenBest(amount?: number|null): string {
    if (!amount) {
      return '0';
    }

    return (amount / 1000 / 1000).toFixed(6);
  }

  public getPairFrom(token?: Token|null): string {
    let from = '';
    if (token?.mintingData?.network === Network.ATOI) {
      from = 'MATOI';
    } else if (token?.mintingData?.network === Network.SMR) {
      from = 'SMR';
    } else if (token?.mintingData?.network === Network.RMS) {
      from = 'RMS';
    } else {
      from = 'MIOTA';
    }
    return from;
  }

  public getPair(token?: Token|null): string {
    return token?.symbol + '/' + this.getPairFrom(token);
  }

  public saleEndDate(token?: Token): dayjs.Dayjs {
    return dayjs(token?.saleStartDate?.toDate()).add(token?.saleLength || 0, 'ms');
  }

  public isInProcessing(token?: Token): boolean {
    return token?.status === TokenStatus.PROCESSING;
  }

  public isScheduledForSale(token?: Token): boolean {
    return (
      !!token?.approved &&
      (token?.status === TokenStatus.AVAILABLE || token?.status === TokenStatus.PROCESSING) &&
      !!token?.saleStartDate
    );
  }

  public isAfterSaleStarted(token?: Token): boolean {
    return (
      !!token?.approved &&
      dayjs(token?.saleStartDate?.toDate()).isBefore(dayjs())
    );
  }

  public isProcessing(token?: Token): boolean {
    return token?.status === TokenStatus.PROCESSING;
  }

  public isInCooldown(token?: Token): boolean {
    return (
      !!token?.approved &&
      (token?.status === TokenStatus.AVAILABLE || token?.status === TokenStatus.PROCESSING) &&
      dayjs(token?.coolDownEnd?.toDate()).isAfter(dayjs()) &&
      dayjs(token?.saleStartDate?.toDate()).add(token?.saleLength || 0, 'ms').isBefore(dayjs())
    );
  }

  public isAvailableForSale(token?: Token): boolean {
    return (
      !!token?.approved &&
      token?.status === TokenStatus.AVAILABLE &&
      dayjs(token?.saleStartDate?.toDate()).isBefore(dayjs()) &&
      dayjs(token?.saleStartDate?.toDate()).add(token?.saleLength || 0, 'ms').isAfter(dayjs())
    );
  }

  public isSalesInProgress(token?: Token): boolean {
    return (
      !!token?.approved &&
      token?.status === TokenStatus.AVAILABLE &&
      dayjs(token?.saleStartDate?.toDate()).isBefore(dayjs()) &&
      dayjs(token?.coolDownEnd?.toDate()).isAfter(dayjs())
    );
  }

  public isMinted(token?: Token | null): boolean {
    return token?.status === TokenStatus.MINTED;
  }

  public getExplorerUrl(token?: Token | null): string {
    if (token?.mintingData?.network === Network.RMS) {
      return 'https://explorer.shimmer.network/testnet/block/' + token.mintingData.blockId;
    } else if (token?.mintingData?.network === Network.IOTA) {
      return 'https://explorer.shimmer.network/testnet/block/' + token.mintingData.blockId;
    } else if (token?.mintingData?.network === Network.SMR) {
      return 'https://explorer.shimmer.network/testnet/block/' + token.mintingData.blockId;
    } else if (token?.mintingData?.network === Network.ATOI) {
      return 'https://explorer.shimmer.network/testnet/block/' + token.mintingData.blockId;
    } else {
      return '';
    }
  }

  public isAfterCooldown(token?: Token): boolean {
    return (
      !!token?.approved &&
      dayjs(token?.coolDownEnd?.toDate()).isBefore(dayjs())
    ) || token?.status === TokenStatus.MINTED;
  }

  public getCooldownDuration(token?: Token): string {
    if (!token || !token.coolDownEnd || !token.saleStartDate) {
      return '-';
    }

    const v: number = dayjs(token.coolDownEnd.toDate()).diff(dayjs(token.saleStartDate.toDate()).add(token.saleLength || 0, 'ms'), 'ms');
    return dayjs.duration({ milliseconds: v }).humanize();
  }

  public hasPublicSale(token?: Token): boolean {
    return !!(token?.allocations && token.allocations.filter(a => a.isPublicSale).length > 0);
  }

  public getShareUrl(token?: Token | null): string {
    return token?.wenUrlShort || token?.wenUrl || window.location.href;
  }

  public isExpired(val?: Transaction | null): boolean {
    if (!val?.createdOn) {
      return false;
    }

    const expiresOn: dayjs.Dayjs = dayjs(val.createdOn.toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
    return expiresOn.isBefore(dayjs()) && val.type === TransactionType.ORDER;
  }

  public vestingInFuture(drop?: TokenDrop): boolean {
    if (!drop) {
      return false;
    }
    return dayjs(drop.vestingAt.toDate()).isAfter(dayjs());
  }

  public salesInProgressOrUpcoming(token: Token): boolean {
    return (
      !!token.saleStartDate &&
      dayjs(token.saleStartDate?.toDate()).isBefore(dayjs()) &&
      token?.status !== TokenStatus.PRE_MINTED &&
      token?.approved
    );
  }
}
