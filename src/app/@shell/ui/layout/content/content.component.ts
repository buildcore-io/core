import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NavigationService } from '@core/services/navigation/navigation.service';

@Component({
  selector: 'wen-content',
  templateUrl: './content.component.html',
  styleUrls: ['./content.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentComponent {
  @Input() showBackButton = false

  constructor(public nav: NavigationService) { }
}
