import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';

@Pipe({
  name: 'markdown',
})
export class MarkDownPipe implements PipeTransform {
  private md = marked.setOptions({
    breaks: true
  });
  constructor() {
    const walkTokens = (token: any) => {
      if (token.type === 'heading') {
        // Add depth.
        token.depth += 2;
      }
    };

    this.md.use({ walkTokens });
  }

  transform(str: string | undefined): string {
    return str ? this.md.parse(str) : '';
  }
}
