import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { SpaceApi } from '@api/space.api';
import { TokenApi } from '@api/token.api';
import { MockProvider } from 'ng-mocks';
import { TokenPage } from './token.page';


describe('TokenPage', () => {
  let component: TokenPage;
  let fixture: ComponentFixture<TokenPage>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenPage ],
      providers: [
        MockProvider(TokenApi),
        MockProvider(ActivatedRoute),
        MockProvider(SpaceApi)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
