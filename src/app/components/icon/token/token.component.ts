import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'wen-icon-token',
  templateUrl: './token.component.html',
  styleUrls: ['./token.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenIconComponent {
  @Input() size = 24;
}
