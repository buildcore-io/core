import { registerLocaleData } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import en from '@angular/common/locales/en';
import fr from '@angular/common/locales/fr';
import { LOCALE_ID, NgModule } from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { WebShellModule } from '@shell/ft/web-shell.module';
import { FirebaseOptions } from 'firebase/app';
import { en_US, fr_FR, NZ_I18N } from 'ng-zorro-antd/i18n';
import { CoreModule } from './@core/core.module';
import { WenComponent } from './app.component';
registerLocaleData(en);
registerLocaleData(fr);

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyB4fcG8rtNWAiAtSmxmK3q3JLfMvtNCGP4",
  authDomain: "soonaverse.firebaseapp.com",
  projectId: "soonaverse",
  // storageBucket: "soonaverse.appspot.com",
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
    FormsModule,
    HttpClientModule,
    BrowserAnimationsModule,

    // Firebase.
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideFirestore(() => getFirestore())

  ],
  bootstrap: [WenComponent],
  providers   : [{
    provide: NZ_I18N,
    useFactory: (localId: string) => {
      /** keep the same with angular.json/i18n/locales configuration **/
      switch (localId) {
        case 'en':
          return en_US;
        case 'fr':
          return fr_FR;
        default:
          return en_US;
      }
    },
    deps: [LOCALE_ID]
  }]
})
export class AppModule {}
