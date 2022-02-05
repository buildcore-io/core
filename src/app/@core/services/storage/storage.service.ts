import { Injectable } from '@angular/core';
import { DEFAULT_SPACE } from '@components/select-space/select-space.component';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  public selectedSpace = new BehaviorSubject<string>(DEFAULT_SPACE.value);
  public isIncludeAlliancesChecked = new BehaviorSubject<boolean>(false);
}
