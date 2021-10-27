import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { SignOutComponent } from './sign-out.component';

describe('SignOutPage', () => {
  let component: SignOutComponent;
  let fixture: ComponentFixture<SignOutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SignOutComponent],
      imports: [RouterTestingModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SignOutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should click button', fakeAsync(() => {
    jest.spyOn(component, 'onClickSignOut');
    let button: any = fixture.debugElement.nativeElement.querySelector('button');
    button.click();
    tick();
    expect(component.onClickSignOut).toHaveBeenCalled();
  }));
});
