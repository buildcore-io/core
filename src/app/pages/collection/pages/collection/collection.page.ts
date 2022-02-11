import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';

@Component({
  selector: 'wen-collection',
  templateUrl: './collection.page.html',
  styleUrls: ['./collection.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionPage {
  public isAboutCollectionVisible = false;

  constructor(
    public deviceService: DeviceService
  ) {}

  public approve(): void {
    // Needs to be implemented
  }
}