import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccessBadgeComponent } from './collection-access-badge.component';


describe('AccessBadgeComponent', () => {
  let component: AccessBadgeComponent;
  let fixture: ComponentFixture<AccessBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AccessBadgeComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AccessBadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
