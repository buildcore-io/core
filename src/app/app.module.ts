import { registerLocaleData } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import de from '@angular/common/locales/de';
import en from '@angular/common/locales/en';
import es from '@angular/common/locales/es';
import fr from '@angular/common/locales/fr';
import it from '@angular/common/locales/it';
import tr from '@angular/common/locales/tr';
import { LOCALE_ID, NgModule } from '@angular/core';
import { initializeApp, provideFirebaseApp } from "@angular/fire/app";
import { provideAppCheck } from "@angular/fire/app-check";
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAnalyticsModule } from '@angular/fire/compat/analytics';
import { AngularFirestoreModule, USE_EMULATOR as USE_FIRESTORE_EMULATOR } from '@angular/fire/compat/firestore';
import { AngularFireFunctionsModule, USE_EMULATOR as USE_FUNCTIONS_EMULATOR } from '@angular/fire/compat/functions';
import { AngularFirePerformanceModule, PerformanceMonitoringService } from '@angular/fire/compat/performance';
import { AngularFireStorageModule, USE_EMULATOR as USE_STORAGE_EMULATOR } from '@angular/fire/compat/storage';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { IconDefinition } from '@ant-design/icons-angular';
import { environment } from '@env/environment';
import { initializeAppCheck, ReCaptchaV3Provider } from '@firebase/app-check';
import { WebShellModule } from '@shell/ft/web-shell.module';
import {
  de_DE as DeDe,
  // en_US as EnUs,
  en_GB as EnGb, es_ES as EsEs, fr_FR as FrFr, it_IT as ItIt, NZ_I18N as Nzi18n, tr_TR as TrTR
} from 'ng-zorro-antd/i18n';
import { NzIconModule } from "ng-zorro-antd/icon";
import { CoreModule } from './@core/core.module';
import { WenComponent } from './app.component';

// Register languages.
registerLocaleData(en);
registerLocaleData(de);
registerLocaleData(fr);
registerLocaleData(es);
registerLocaleData(it);
registerLocaleData(tr);

const icons: IconDefinition[] = [];
const emulator = false;

const imports: any[] = [
  BrowserModule,
  CoreModule,
  WebShellModule,
  HttpClientModule,
  BrowserAnimationsModule,
  NzIconModule.forRoot(icons),
  // Interim-Firebase.
  AngularFireModule.initializeApp(environment.fbConfig),
  provideFirebaseApp(() => initializeApp(environment.fbConfig)),
  AngularFirestoreModule,
  AngularFireFunctionsModule,
  AngularFireStorageModule
];

// AppCheck only in production.
if (environment.production) {
  imports.push(provideAppCheck(() =>  {
    const provider = new ReCaptchaV3Provider(environment.captcha);
    return initializeAppCheck(undefined, { provider, isTokenAutoRefreshEnabled: true });
  }));

  // In production enable performance monitoring.
  imports.push(AngularFirePerformanceModule);
  imports.push(AngularFireAnalyticsModule);
}

@NgModule({
  declarations: [WenComponent],
  imports: imports,
  bootstrap: [WenComponent],
  providers: [
    PerformanceMonitoringService,
    {
    provide: Nzi18n,
    useFactory: (localId: string) => {
      /** keep the same with angular.json/i18n/locales configuration **/
      switch (localId) {
        case 'en':
          return EnGb;
        case 'de':
          return DeDe;
        case 'es':
          return EsEs;
        case 'fr':
          return FrFr;
        case 'it':
          return ItIt;
        case 'tr':
          return TrTR;
        default:
          return EnGb;
      }
    },
    deps: [LOCALE_ID]
  },
  { provide: USE_FIRESTORE_EMULATOR, useValue: emulator ? ['localhost', 8080] : undefined },
  { provide: USE_FUNCTIONS_EMULATOR, useValue: emulator ? ['localhost', 5001] : undefined },
  { provide: USE_STORAGE_EMULATOR, useValue: emulator ? ['localhost', 5001] : undefined }
  ]
})
export class AppModule { }
