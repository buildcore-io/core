import { ComponentFixture, TestBed } from '@angular/core/testing';
import { YieldPage } from './yield.page';


describe('YieldPage', () => {
  let component: YieldPage;
  let fixture: ComponentFixture<YieldPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ YieldPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(YieldPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
