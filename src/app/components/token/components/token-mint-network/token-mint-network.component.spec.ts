import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TokenMintNetworkComponent } from './token-mint-network.component';

describe('TokenMintNetworkComponent', () => {
  let component: TokenMintNetworkComponent;
  let fixture: ComponentFixture<TokenMintNetworkComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenMintNetworkComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenMintNetworkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
