import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenProgressComponent } from './token-progress.component';


describe('TokenProgressComponent', () => {
  let component: TokenProgressComponent;
  let fixture: ComponentFixture<TokenProgressComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenProgressComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenProgressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
