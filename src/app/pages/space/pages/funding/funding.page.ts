import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';

@Component({
  selector: 'wen-funding',
  templateUrl: './funding.page.html',
  styleUrls: ['./funding.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FundingPage implements OnInit {

  constructor() { }

  ngOnInit(): void {
    // none.
  }

}
