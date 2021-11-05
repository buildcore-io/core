import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UnamusedIconComponent } from './unamused.component';


describe('UnamusedComponent', () => {
  let component: UnamusedIconComponent;
  let fixture: ComponentFixture<UnamusedIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UnamusedIconComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UnamusedIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
