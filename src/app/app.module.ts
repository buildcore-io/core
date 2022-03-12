import { registerLocaleData } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import cs from '@angular/common/locales/cs';
import de from '@angular/common/locales/de';
import en from '@angular/common/locales/en';
import es from '@angular/common/locales/es';
import fr from '@angular/common/locales/fr';
import it from '@angular/common/locales/it';
import ja from '@angular/common/locales/ja';
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
import { environment } from '@env/environment';
import { initializeAppCheck, ReCaptchaV3Provider } from '@firebase/app-check';
import { WebShellModule } from '@shell/ft/web-shell.module';
/* eslint-disable */
import {
  cs_CZ, de_DE, en_GB, es_ES, fr_FR, it_IT, ja_JP, NZ_I18N, pl_PL, pt_BR, pt_PT, ru_RU, tr_TR, uk_UA, zh_CN
} from 'ng-zorro-antd/i18n';
/* eslint-enable */
import { NzIconModule } from "ng-zorro-antd/icon";
import { CoreModule } from './@core/core.module';
import { WenComponent } from './app.component';

// Register languages.
registerLocaleData(en);
registerLocaleData(cs);
registerLocaleData(de);
registerLocaleData(fr);
registerLocaleData(es);
registerLocaleData(it);
registerLocaleData(tr);
registerLocaleData(ja);
registerLocaleData(pl);
registerLocaleData(pt);
registerLocaleData(qu);
registerLocaleData(ru);
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
    /* eslint-disable */
    provide: NZ_I18N,
    useFactory: (localId: string) => {
      /** keep the same with angular.json/i18n/locales configuration **/
      switch (localId) {
        case 'cs-CZ':
          return cs_CZ;
        case 'de-DE':
          return de_DE;
        case 'es-ES':
          return es_ES;
        case 'fr-FR':
          return fr_FR;
        case 'it-IT':
          return it_IT;
        case 'ja-JP':
          return ja_JP;
        case 'pl-PL':
          return pl_PL;
        case 'pt-BR':
          return pt_BR;
        case 'pt-PT':
          return pt_PT;
        // case 'qu-PE':
        //   return qu;
        case 'ru-RU':
          return ru_RU;
        case 'tr-TR':
          return tr_TR;
        case 'uk-UA':
          return uk_UA;
        case 'zh-CN':
          return zh_CN;
        default:
          return en_GB;
      }
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
