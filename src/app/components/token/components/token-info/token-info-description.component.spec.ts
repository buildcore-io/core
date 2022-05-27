import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenApi } from '@api/token.api';
import { MockProvider } from 'ng-mocks';
import { TokenInfoDescriptionComponent } from './token-info-description.component';


describe('TokenInfoDescriptionComponent', () => {
  let component: TokenInfoDescriptionComponent;
  let fixture: ComponentFixture<TokenInfoDescriptionComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenInfoDescriptionComponent ],
      providers: [
        MockProvider(TokenApi)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenInfoDescriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
