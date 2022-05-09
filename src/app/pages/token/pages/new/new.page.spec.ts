import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FileApi } from '@api/file.api';
import { MemberApi } from '@api/member.api';
import { TokenApi } from '@api/token.api';
import { AuthService } from '@components/auth/services/auth.service';
import { MockProvider } from 'ng-mocks';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NewPage } from './new.page';


describe('NewPage', () => {
  let component: NewPage;
  let fixture: ComponentFixture<NewPage>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ NewPage ],
      providers: [
        MockProvider(AuthService),
        MockProvider(MemberApi),
        MockProvider(NzNotificationService),
        MockProvider(FileApi),
        MockProvider(TokenApi),
        MockProvider(Router)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NewPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
