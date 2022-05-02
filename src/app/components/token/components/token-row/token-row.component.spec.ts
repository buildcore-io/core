import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenRowComponent } from './token-row.component';


describe('TokenRowComponent', () => {
  let component: TokenRowComponent;
  let fixture: ComponentFixture<TokenRowComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenRowComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenRowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
