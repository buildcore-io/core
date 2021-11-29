import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AngleDownIconComponent } from './angle-down/angle-down.component';
import { AngleLeftIconComponent } from './angle-left/angle-left.component';
import { AngleUpIconComponent } from './angle-up/angle-up.component';
import { AwardIconComponent } from './award/award.component';
import { BellIconComponent } from './bell/bell.component';
import { CheckCircleIconComponent } from './check-circle/check-circle.component';
import { DiscordIconComponent } from './discord/discord.component';
import { FacebookIconComponent } from './facebook/facebook.component';
import { GithubIconComponent } from './github/github.component';
import { GlobeIconComponent } from './globe/globe.component';
import { LinkedinIconComponent } from './linkedin/linkedin.component';
import { MarketIconComponent } from './market/market.component';
import { MembersIconComponent } from './members/members.component';
import { MoonIconComponent } from './moon/moon.component';
import { MoreIconComponent } from './more/more.component';
import { QuestionCircleIconComponent } from './question-circle/question-circle.component';
import { RedditIconComponent } from './reddit/reddit.component';
import { RocketIconComponent } from './rocket/rocket.component';
import { SpaceIconComponent } from './space/space.component';
import { SunIconComponent } from './sun/sun.component';
import { TwitterIconComponent } from './twitter/twitter.component';
import { UnamusedIconComponent } from './unamused/unamused.component';

@NgModule({
  declarations: [
    GlobeIconComponent,
    RocketIconComponent,
    MoreIconComponent,
    UnamusedIconComponent,
    SunIconComponent,
    MoonIconComponent,
    MembersIconComponent,
    MarketIconComponent,
    BellIconComponent,
    SpaceIconComponent,
    AwardIconComponent,
    CheckCircleIconComponent,
    QuestionCircleIconComponent,
    AngleDownIconComponent,
    AngleUpIconComponent,
    TwitterIconComponent,
    FacebookIconComponent,
    LinkedinIconComponent,
    GithubIconComponent,
    DiscordIconComponent,
    RedditIconComponent,
    AngleLeftIconComponent,
  ],
  exports: [
    GlobeIconComponent,
    RocketIconComponent,
    MoreIconComponent,
    UnamusedIconComponent,
    SunIconComponent,
    MoonIconComponent,
    MembersIconComponent,
    MarketIconComponent,
    BellIconComponent,
    SpaceIconComponent,
    AwardIconComponent,
    CheckCircleIconComponent,
    QuestionCircleIconComponent,
    AngleDownIconComponent,
    AngleUpIconComponent,
    TwitterIconComponent,
    FacebookIconComponent,
    LinkedinIconComponent,
    GithubIconComponent,
    DiscordIconComponent,
    RedditIconComponent,
    AngleLeftIconComponent,
  ],
  imports: [
    CommonModule
  ]
})
export class IconModule { }
