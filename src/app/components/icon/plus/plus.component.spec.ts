import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlusIconComponent } from './plus.component';


describe('PlusIconComponent', () => {
  let component: PlusIconComponent;
  let fixture: ComponentFixture<PlusIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PlusIconComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PlusIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
