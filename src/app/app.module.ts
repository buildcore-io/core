import { registerLocaleData } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import cs from '@angular/common/locales/cs';
import de from '@angular/common/locales/de';
import en from '@angular/common/locales/en';
import es from '@angular/common/locales/es';
import fr from '@angular/common/locales/fr';
import it from '@angular/common/locales/it';
import ja from '@angular/common/locales/ja';
import ko from '@angular/common/locales/ko';
import nl from '@angular/common/locales/nl';
import pl from '@angular/common/locales/pl';
import pt from '@angular/common/locales/pt';
import qu from '@angular/common/locales/qu';
import ru from '@angular/common/locales/ru';
import tr from '@angular/common/locales/tr';
import uk from '@angular/common/locales/uk';
import zh from '@angular/common/locales/zh';
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
import { Languages } from '@core/utils/language.util';
import { environment } from '@env/environment';
import { initializeAppCheck, ReCaptchaV3Provider } from '@firebase/app-check';
import { WebShellModule } from '@shell/ft/web-shell.module';
import { getApp } from 'firebase/app';
/* eslint-disable */
import { NZ_I18N } from 'ng-zorro-antd/i18n';
/* eslint-enable */
import { NzIconModule } from "ng-zorro-antd/icon";
import { CoreModule } from './@core/core.module';
import { WenComponent } from './app.component';

// Register languages.
registerLocaleData(en);
registerLocaleData(cs);
registerLocaleData(de);
registerLocaleData(es);
registerLocaleData(fr);
registerLocaleData(it);
registerLocaleData(ja);
registerLocaleData(ko);
registerLocaleData(nl);
registerLocaleData(pl);
registerLocaleData(pt);
registerLocaleData(qu);
registerLocaleData(ru);
registerLocaleData(tr);
registerLocaleData(uk);
registerLocaleData(zh);

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
    return initializeAppCheck(getApp(), { provider, isTokenAutoRefreshEnabled: true });
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
    /* eslint-disable */
    provide: NZ_I18N,
    useFactory: (localId: string) => {
      /** keep the same with angular.json/i18n/locales configuration **/
      return Languages[localId]?.ngZorro || Languages.en.ngZorro;
      /* eslint-enable */
    },
    deps: [LOCALE_ID]
  },
  { provide: USE_FIRESTORE_EMULATOR, useValue: emulator ? ['localhost', 8080] : undefined },
  { provide: USE_FUNCTIONS_EMULATOR, useValue: emulator ? ['localhost', 5001] : undefined },
  { provide: USE_STORAGE_EMULATOR, useValue: emulator ? ['localhost', 5001] : undefined }
  ]
})
export class AppModule { }
