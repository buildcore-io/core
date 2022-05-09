import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenApi } from '@api/token.api';
import { CacheService } from '@core/services/cache/cache.service';
import { MockProvider } from 'ng-mocks';
import { TokensPage } from './tokens.page';
import {BehaviorSubject} from "rxjs";
import {Collection, Space} from "@functions/interfaces/models";


describe('TokensPage', () => {
  let component: TokensPage;
  let fixture: ComponentFixture<TokensPage>;
  const allSpaces$ = new BehaviorSubject<Space[]>([]);
  const allCollections$ = new BehaviorSubject<Collection[]>([]);


  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokensPage ],
      providers: [
        MockProvider(CacheService),
        MockProvider(SpaceApi),
        MockProvider(CacheService, {allSpaces$, allCollections$})
        MockProvider(TokenApi)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokensPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
