import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SoonlabsIconComponent } from './soonlabs.component';


describe('SoonlabsIconComponent', () => {
  let component: SoonlabsIconComponent;
  let fixture: ComponentFixture<SoonlabsIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SoonlabsIconComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SoonlabsIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
