import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { collection, collectionData, Firestore } from '@angular/fire/firestore';
import { AuthService } from '@components/auth/services/auth.service';
import { SeoService } from '@core/services/seo';
import { ThemeService } from '@core/services/theme';
import { Observable } from 'rxjs';

@Component({
  selector: 'wen-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WenComponent implements OnInit {
  isLoggedIn$!: Observable<boolean>;

  constructor(
    private seoService: SeoService,
    private themeService: ThemeService,
    private authService: AuthService,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    this.isLoggedIn$ = this.authService.isLoggedIn$;
    this.runGlobalServices();
  }

  private runGlobalServices(): void {
    this.seoService.init();
    this.themeService.init();

    // Test retrieval from DB.
    const col: any = collection(this.firestore, 'config');
    collectionData(col).subscribe((o) => {
      console.log(o);
    })
  }
}
