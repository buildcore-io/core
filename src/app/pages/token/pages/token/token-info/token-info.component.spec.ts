import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TokenInfoComponent } from './token-info.component';

describe('TokenInfoComponent', () => {
  let component: TokenInfoComponent;
  let fixture: ComponentFixture<TokenInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TokenInfoComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
