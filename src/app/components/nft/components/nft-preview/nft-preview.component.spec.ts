import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileApi } from '@api/file.api';
import { AuthService } from '@components/auth/services/auth.service';
import { CacheService } from '@core/services/cache/cache.service';
import { DataService } from '@pages/nft/services/data.service';
import { MockProvider } from 'ng-mocks';
import { NftPreviewComponent } from './nft-preview.component';


describe('NftPreviewComponent', () => {
  let component: NftPreviewComponent;
  let fixture: ComponentFixture<NftPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NftPreviewComponent ],
      providers: [MockProvider(DataService), MockProvider(AuthService), MockProvider(CacheService), MockProvider(FileApi)]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NftPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
