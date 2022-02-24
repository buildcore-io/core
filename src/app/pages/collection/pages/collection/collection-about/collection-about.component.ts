import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { DataService } from '../../../services/data.service';

@Component({
  selector: 'wen-collection-about',
  templateUrl: './collection-about.component.html',
  styleUrls: ['./collection-about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionAboutComponent {
  constructor(
    public data: DataService,
    public deviceService: DeviceService
  ) {
    // none.
  }

  public getShareUrl(): string {
    return 'http://twitter.com/share?text=Check out collection&url=' + window.location.href + '&hashtags=soonaverse';
  }
}
