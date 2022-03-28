import { Pipe, PipeTransform } from '@angular/core';
import MarkdownIt, { Options } from 'markdown-it';

@Pipe({
  name: 'markdown',
})
export class MarkDownPipe implements PipeTransform {
  public transform(str: string | undefined): string {
    if (!str) {
      return '';
    }

    const md = new MarkdownIt({
      linkify: true,
      typographer: true
    } as Options);
    const output = md.render(str);
    return String(output);
  }
}
