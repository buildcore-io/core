import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SunIconComponent } from './sun.component';


describe('SunIconComponent', () => {
  let component: SunIconComponent;
  let fixture: ComponentFixture<SunIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SunIconComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SunIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
