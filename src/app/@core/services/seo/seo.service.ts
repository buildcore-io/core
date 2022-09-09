import { Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
@Injectable({
  providedIn: 'root',
})
export class SeoService {

  constructor(
    private titleService: Title,
    private metaService: Meta,
  ) {}

  public setTags(title?: string, description?: string, image?: string): void {
    this.setTitle(title);
    this.setDescription(description);
    this.setImage(image);
  }

  private setTitle(title?: string): void {
    if (title) {
      title += ' | Soonaverse';
      
      this.titleService.setTitle(title);

      this.metaService.updateTag({
        property: 'og:title',
        content: title
      });
    }
  }

  private setDescription(description?: string): void {
    if (description) {
      this.metaService.updateTag({
        name: 'description',
        content: description,
      });

      this.metaService.updateTag({
        property: 'og:description',
        content: description
      });
    }
  }

  private setImage(image?: string): void {
    if (image) {
      this.metaService.updateTag({
        property: 'og:image',
        content: image
      });
    }
  }
}
