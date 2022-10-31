import { Injectable } from '@angular/core';
import { DEFAULT_SPACE } from '@components/space/components/select-space/select-space.component';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  public selectedSpace = new BehaviorSubject<string>(DEFAULT_SPACE.value);
}
