import { CommonModule } from '@angular/common';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NzNotificationModule } from 'ng-zorro-antd/notification';
import { JwtInterceptor, ServerErrorInterceptor } from './interceptors';

@NgModule({
  declarations: [],
  imports: [CommonModule, HttpClientModule, NzNotificationModule],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ServerErrorInterceptor,
      multi: true,
    },
    { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
  ],
})
export class CoreModule {}
