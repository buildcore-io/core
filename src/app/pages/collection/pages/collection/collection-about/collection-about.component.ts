import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DataService } from '../../../services/data.service';

@Component({
  selector: 'wen-collection-about',
  templateUrl: './collection-about.component.html',
  styleUrls: ['./collection-about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionAboutComponent {
  constructor(public data: DataService) {
    // none.
  }

  public getShareUrl(): string {
    return 'http://twitter.com/share?text=Check out collection&url=' + window.location.href + '&hashtags=soonaverse';
  }
}
