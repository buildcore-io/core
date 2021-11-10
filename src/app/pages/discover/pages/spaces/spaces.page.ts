import { ChangeDetectionStrategy, Component } from '@angular/core';
const iotaToken = 'assets/mocks/iota-token.png';
const iota = 'assets/mocks/iota-treasury.png';
const soonlabsToken = 'assets/mocks/soonlabs-token.png';
const soonlabs = 'assets/mocks/soonlabs.png';

@Component({
  templateUrl: './spaces.page.html',
  styleUrls: ['./spaces.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpacesPage {

  spaces = [
    { id: 1, title: 'IOTA Treasury', description: 'The IOTA Community will be able to vote to allocate all unclaimed tokens from previous network updates into anothe', members: 20, cover: iota, token: iotaToken },
    { id: 2, title: 'SoonLabs', description: 'Media initiative tied to the John Wick movie franchise.', members: 20, cover: soonlabs, token: soonlabsToken },
    { id: 3, title: 'IOTA Treasury', description: 'The IOTA Community will be able to vote to allocate all unclaimed tokens from previous network updates into anothe', members: 20, cover: iota, token: iotaToken },
    { id: 4, title: 'SoonLabs', description: 'Media initiative tied to the John Wick movie franchise.', members: 20, cover: soonlabs, token: soonlabsToken },
    { id: 5, title: 'IOTA Treasury', description: 'The IOTA Community will be able to vote to allocate all unclaimed tokens from previous network updates into anothe', members: 20, cover: iota, token: iotaToken },
    { id: 6, title: 'SoonLabs', description: 'Media initiative tied to the John Wick movie franchise.', members: 20, cover: soonlabs, token: soonlabsToken },
    { id: 7, title: 'IOTA Treasury', description: 'The IOTA Community will be able to vote to allocate all unclaimed tokens from previous network updates into anothe', members: 20, cover: iota, token: iotaToken },
    { id: 8, title: 'SoonLabs', description: 'Media initiative tied to the John Wick movie franchise.', members: 20, cover: soonlabs, token: soonlabsToken },
  ]
}
