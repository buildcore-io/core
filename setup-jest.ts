import { HttpClientModule } from '@angular/common/http';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { ReactiveFormsModule } from '@angular/forms';
import { defineGlobalsInjections } from '@ngneat/spectator';
import 'jest-preset-angular/setup-jest';
import { MockProvider, ngMocks } from 'ng-mocks';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzNotificationModule, NzNotificationService } from 'ng-zorro-antd/notification';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { TruncateModule } from './src/app/@core/pipes/truncate/truncate.module';

// Default injections available everywhere.
defineGlobalsInjections({
  imports: [
    ReactiveFormsModule,
    HttpClientModule,
    NzCardModule,
    TruncateModule,
    NzGridModule,
    NzMenuModule,
    NzButtonModule,
    NzTypographyModule,
    NzNotificationModule,
    NzInputModule,
    NzIconModule,
    NzUploadModule,
    NzAvatarModule,
    NzStatisticModule,
    NzLayoutModule,
    NzDropDownModule,
    NzFormModule,
    NzDrawerModule
  ],
  providers: [MockProvider(AngularFirestore), MockProvider(AngularFireFunctions)]
});

ngMocks.autoSpy('jest');

// Default mocks
ngMocks.defaultMock(NzNotificationService);

const mock = () => {
  let storage: { [key: string]: string } = {};
  return {
    getItem: (key: string) => (key in storage ? storage[key] : null),
    setItem: (key: string, value: string) => (storage[key] = value || ''),
    removeItem: (key: string) => delete storage[key],
    clear: () => (storage = {}),
  };
};

Object.defineProperty(window, 'localStorage', { value: mock() });
Object.defineProperty(window, 'sessionStorage', { value: mock() });
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ['-webkit-appearance'],
});

Object.defineProperty(document.body.style, 'transform', {
  value: () => {
    return {
      enumerable: true,
      configurable: true,
    };
  },
});
