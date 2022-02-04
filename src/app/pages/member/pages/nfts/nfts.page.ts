import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'wen-nfts',
  templateUrl: './nfts.page.html',
  styleUrls: ['./nfts.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NFTsPage implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
