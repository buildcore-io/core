import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RocketIconComponent } from './rocket.component';


describe('RocketComponent', () => {
  let component: RocketIconComponent;
  let fixture: ComponentFixture<RocketIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RocketIconComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RocketIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
