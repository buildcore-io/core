import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MoonIconComponent } from './moon.component';


describe('MoonIconComponent', () => {
  let component: MoonIconComponent;
  let fixture: ComponentFixture<MoonIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MoonIconComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MoonIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
