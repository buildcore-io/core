import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AirdropsPage } from './airdrops.page';


describe('AirdropsPage', () => {
  let component: AirdropsPage;
  let fixture: ComponentFixture<AirdropsPage>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ AirdropsPage ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AirdropsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
