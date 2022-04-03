import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { Transaction } from '@functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';
import { DataService } from './../../services/data.service';

@Component({
  selector: 'wen-badges',
  templateUrl: './badges.page.html',
  styleUrls: ['./badges.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BadgesPage {
  constructor(private auth: AuthService, public data: DataService) {
    // none.
  }

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }

  public trackByUid(index: number, item: Transaction) {
    return item.uid;
  }
}
