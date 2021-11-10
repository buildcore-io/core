import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AwardsPage } from './awards.page';


describe('AwardsPage', () => {
  let component: AwardsPage;
  let fixture: ComponentFixture<AwardsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AwardsPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AwardsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
