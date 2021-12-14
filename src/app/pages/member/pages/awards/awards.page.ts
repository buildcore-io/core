import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { AuthService } from '@components/auth/services/auth.service';
import { BehaviorSubject } from 'rxjs';
import { Award } from './../../../../../../functions/interfaces/models/award';
import { DataService } from './../../services/data.service';

enum FilterOptions {
  PENDING = 'pending',
  ISSUED = 'issued'
}

@Component({
  selector: 'wen-awards',
  templateUrl: './awards.page.html',
  styleUrls: ['./awards.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwardsPage {
  public selectedListControl: FormControl = new FormControl(FilterOptions.PENDING);
  constructor(private auth: AuthService, private cd: ChangeDetectorRef, public data: DataService) {
    // none.
  }

  public get filterOptions(): typeof FilterOptions {
    return FilterOptions;
  }


  public getList(): BehaviorSubject<Award[]|undefined> {
    if (this.selectedListControl.value === this.filterOptions.ISSUED) {
      return this.data.awardsPending$;
    } else {
      return this.data.awardsCompleted$;
    }
  }

  public handleFilterChange(filter: FilterOptions): void {
    this.selectedListControl.setValue(filter);
    this.cd.markForCheck();
  }

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
