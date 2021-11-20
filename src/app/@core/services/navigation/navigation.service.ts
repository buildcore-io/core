import { Location } from "@angular/common";
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  constructor(
    private location: Location
  ) {
    // none.
  }

  // public getPreviousPage(): string {
  //   if (true) {
  //     return 'Discover';
  //   } else if (true) {
  //     return 'Space';
  //   } else if (true) {
  //     return 'Profile';
  //   } else if (true) {
  //     return 'Profile';
  //   }
  // }

  public getTitle(): string {
    return 'Back';
  }

  public goBack(): void {
    this.location.back();
  }
}
