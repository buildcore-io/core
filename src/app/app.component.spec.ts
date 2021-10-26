import { APP_BASE_HREF } from '@angular/common';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { WebShellModule } from '@shell/ft/web-shell.module';
import { WenComponent } from './app.component';

describe.skip('WenComponent', () => {
  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        imports: [RouterTestingModule, WebShellModule],
        declarations: [WenComponent],
        providers: [{ provide: APP_BASE_HREF, useValue: '/' }],
      }).compileComponents();
    }),
  );

  it('should create the app', () => {
    const fixture = TestBed.createComponent(WenComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
