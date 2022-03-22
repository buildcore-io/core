import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { copyToClipboard } from '@core/utils/tools.utils';
import { BaseRecord } from '@functions/interfaces/models/base';

@Component({
  selector: 'wen-share',
  templateUrl: './share.component.html',
  styleUrls: ['./share.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShareComponent {
  @Input() shareText = '';
  @Input() shareUrl = '';
  public isCopied = false;

  constructor(
    public deviceService: DeviceService,
    private cd: ChangeDetectorRef
  ) {}
  

  public getShareUrl(item?: BaseRecord | null): string {
    const url: string = (item?.wenUrlShort || item?.wenUrl || window.location.href);
    return 'http://twitter.com/share?text=' + this.shareText + '&url=' + this.shareUrl + '&hashtags=soonaverse';
  }
  
  public copy(): void {
    if (!this.isCopied) {
      copyToClipboard(window.location.href);
      this.isCopied = true;
      setTimeout(() => {
        this.isCopied = false;
        this.cd.markForCheck();
      }, 3000);
    }
  }
}
