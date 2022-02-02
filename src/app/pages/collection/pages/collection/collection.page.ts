import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'wen-collection',
  templateUrl: './collection.page.html',
  styleUrls: ['./collection.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionPage {
}