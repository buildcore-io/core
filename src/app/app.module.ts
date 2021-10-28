import { registerLocaleData } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import en from '@angular/common/locales/en';
import fr from '@angular/common/locales/fr';
import { LOCALE_ID, NgModule } from '@angular/core';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { WebShellModule } from '@shell/ft/web-shell.module';
import { en_US as EnUs, fr_FR as FrFr, NZ_I18N as Nzi18n } from 'ng-zorro-antd/i18n';
import { CoreModule } from './@core/core.module';
import { WenComponent } from './app.component';
registerLocaleData(en);
registerLocaleData(fr);

@NgModule({
  declarations: [WenComponent],
  imports: [
    BrowserModule,
    CoreModule,
    WebShellModule,
    FormsModule,
    HttpClientModule,
    BrowserAnimationsModule,

    // Interim-Firebase.
    AngularFireModule.initializeApp({
      apiKey: "AIzaSyB4fcG8rtNWAiAtSmxmK3q3JLfMvtNCGP4",
      authDomain: "soonaverse.firebaseapp.com",
      projectId: "soonaverse",
      // storageBucket: "soonaverse.appspot.com",
      messagingSenderId: "502842886229",
      appId: "1:502842886229:web:fcb7da4040fd19ba742cdc",
      measurementId: "G-CCX9NVPPCR"
    }),
    AngularFirestoreModule
  ],
  bootstrap: [WenComponent],
  providers   : [{
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
  }]
})
export class AppModule {}
