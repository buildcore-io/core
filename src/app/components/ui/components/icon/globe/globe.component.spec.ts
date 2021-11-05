import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GlobeIconComponent } from './globe.component';


describe('GlobeIconComponent', () => {
  let component: GlobeIconComponent;
  let fixture: ComponentFixture<GlobeIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GlobeIconComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GlobeIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
