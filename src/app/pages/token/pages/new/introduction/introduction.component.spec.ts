import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NewIntroductionComponent } from './introduction.component';


describe('NewIntroductionComponent', () => {
  let component: NewIntroductionComponent;
  let fixture: ComponentFixture<NewIntroductionComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ NewIntroductionComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NewIntroductionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
