import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'wen-token-progress',
  templateUrl: './token-progress.component.html',
  styleUrls: ['./token-progress.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenProgressComponent {
  public getCountdownDate(): Date {
    return new Date('2022-05-30');
  }

  public getCountdownTitle(): string {
    return $localize`Sale ends in`;
  }
}
