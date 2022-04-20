import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TokenPage } from './token.page';

describe('TokenPage', () => {
  let component: TokenPage;
  let fixture: ComponentFixture<TokenPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TokenPage ]
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
