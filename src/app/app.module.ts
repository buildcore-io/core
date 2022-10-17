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
import { getApp, initializeApp, provideFirebaseApp } from "@angular/fire/app";
import { initializeAppCheck, provideAppCheck, ReCaptchaV3Provider } from "@angular/fire/app-check";
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from "@angular/fire/firestore";
import { getFunctions, provideFunctions } from "@angular/fire/functions";
import { getStorage, provideStorage } from "@angular/fire/storage";
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { IconDefinition } from '@ant-design/icons-angular';
import { Languages } from '@core/utils/language.util';
import { environment } from '@env/environment';
import { WebShellModule } from '@shell/ft/web-shell.module';
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
export const imports: any[] = [
  CoreModule,
  WebShellModule,
  HttpClientModule,
  BrowserAnimationsModule,
  NzIconModule.forRoot(icons),
  provideFirebaseApp(() => initializeApp(environment.fbConfig)),
  // provideAuth(() => (typeof document === 'undefined'
  //   ? getAuth(getApp())
  //   : initializeAuth(getApp(), {
  //     persistence: browserLocalPersistence,
  //     popupRedirectResolver: browserPopupRedirectResolver
  //   })
  // )),
  provideAuth(() => getAuth(getApp())),
  provideFirestore(() => getFirestore(initializeApp(environment.fbConfig))),
  provideFunctions(() => getFunctions(initializeApp(environment.fbConfig))),
  provideStorage(() => getStorage(initializeApp(environment.fbConfig)))
];

// AppCheck only in production.
if (environment.production) {
  imports.push(provideAppCheck(() => {
    const provider = new ReCaptchaV3Provider(environment.captcha);
    return initializeAppCheck(getApp(), { provider, isTokenAutoRefreshEnabled: true });
  }));
}

@NgModule({
  declarations: [WenComponent],
  imports: [
    BrowserModule.withServerTransition({ appId: 'serverApp' }),
    ...imports
  ],
  bootstrap: [WenComponent],
  providers: [
    {
      /* eslint-disable */
      provide: NZ_I18N,
      useFactory: (localId: string) => {
        /** keep the same with angular.json/i18n/locales configuration **/
        return Languages[localId]?.ngZorro || Languages.en.ngZorro;
        /* eslint-enable */
      },
      deps: [LOCALE_ID]
    }
  ]
})
export class AppModule { }
