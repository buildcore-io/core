import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'wen-token-launchpad-row',
  templateUrl: './token-launchpad-row.component.html',
  styleUrls: ['./token-launchpad-row.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenLaunchpadRowComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
