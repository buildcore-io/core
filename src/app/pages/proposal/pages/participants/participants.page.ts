import { Component } from '@angular/core';
import { DataService } from "../../services/data.service";

@Component({
  selector: 'wen-participants',
  templateUrl: './participants.page.html',
  styleUrls: ['./participants.page.less']
})
export class ParticipantsPage {
  constructor(
    public data: DataService
  ) {
    // none.
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
