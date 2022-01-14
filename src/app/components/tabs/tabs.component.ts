import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TabSection } from '@pages/discover/pages/discover/discover.page';

@Component({
  selector: 'wen-tabs',
  templateUrl: './tabs.component.html',
  styleUrls: ['./tabs.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TabsComponent {
  @Input() tabs: TabSection[] = []
}
