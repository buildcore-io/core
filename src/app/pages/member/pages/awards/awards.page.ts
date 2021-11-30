import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { BehaviorSubject } from 'rxjs';
import { DataService } from './../../services/data.service';

@Component({
  selector: 'wen-awards',
  templateUrl: './awards.page.html',
  styleUrls: ['./awards.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwardsPage {
  constructor(private auth: AuthService, public data: DataService) {
    // none.
  }

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
