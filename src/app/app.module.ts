import { registerLocaleData } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import en from '@angular/common/locales/en';
import fr from '@angular/common/locales/fr';
import { LOCALE_ID, NgModule } from '@angular/core';
import { initializeApp, provideFirebaseApp } from "@angular/fire/app";
import { provideAppCheck } from "@angular/fire/app-check";
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFirestoreModule, USE_EMULATOR as USE_FIRESTORE_EMULATOR } from '@angular/fire/compat/firestore';
import { AngularFireFunctionsModule, USE_EMULATOR as USE_FUNCTIONS_EMULATOR } from '@angular/fire/compat/functions';
import { AngularFireStorageModule, USE_EMULATOR as USE_STORAGE_EMULATOR } from '@angular/fire/compat/storage';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { IconDefinition } from '@ant-design/icons-angular';
import { initializeAppCheck, ReCaptchaV3Provider } from '@firebase/app-check';
import { WebShellModule } from '@shell/ft/web-shell.module';
import { en_US as EnUs, fr_FR as FrFr, NZ_I18N as Nzi18n } from 'ng-zorro-antd/i18n';
import { NzIconModule } from "ng-zorro-antd/icon";
import { CoreModule } from './@core/core.module';
import { WenComponent } from './app.component';
registerLocaleData(en);
registerLocaleData(fr);
const icons: IconDefinition[] = [];
const emulator = false;

const fbConfig: any = {
  apiKey: "AIzaSyB4fcG8rtNWAiAtSmxmK3q3JLfMvtNCGP4",
  authDomain: "soonaverse.firebaseapp.com",
  projectId: "soonaverse",
  storageBucket: "soonaverse.appspot.com",
  messagingSenderId: "502842886229",
  appId: "1:502842886229:web:fcb7da4040fd19ba742cdc",
  measurementId: "G-CCX9NVPPCR"
};

@NgModule({
  declarations: [WenComponent],
  imports: [
    BrowserModule,
    CoreModule,
    WebShellModule,
    HttpClientModule,
    BrowserAnimationsModule,
    NzIconModule.forRoot(icons),
    // Interim-Firebase.
    AngularFireModule.initializeApp(fbConfig),
    provideFirebaseApp(() => initializeApp(fbConfig)),
    provideAppCheck(() =>  {
      const provider = new ReCaptchaV3Provider('6LfYqHQdAAAAAI91N8xl6pc0LIUj4s9ksqj02CWm');
      return initializeAppCheck(undefined, { provider, isTokenAutoRefreshEnabled: true });
    }),
    AngularFirestoreModule,
    AngularFireFunctionsModule,
    AngularFireStorageModule
  ],
  bootstrap: [WenComponent],
  providers: [{
    provide: Nzi18n,
    useFactory: (localId: string) => {
      /** keep the same with angular.json/i18n/locales configuration **/
      switch (localId) {
        case 'en':
          return EnUs;
        case 'fr':
          return FrFr;
        default:
          return EnUs;
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
