/**
 * Link Button Component
 * A single clickable link button with optional brand icon.
 * Fires a click event for tracking before navigating.
 */

import { ChangeDetectionStrategy, Component, input, output, OnInit } from '@angular/core';
import { CreatorLink } from '@core/models';
import { getBrandByKey, BrandInfo } from '../../utils/brand-detection';

@Component({
  selector: 'app-link-button',
  standalone: true,
  templateUrl: './link-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkButtonComponent implements OnInit {
  public readonly link = input.required<CreatorLink>();
  public readonly themeColor = input<string | null>(null);

  public readonly clicked = output<CreatorLink>();

  protected brandInfo: BrandInfo | null = null;

  public ngOnInit(): void {
    const icon = this.link().icon;
    if (icon) {
      this.brandInfo = getBrandByKey(icon);
    }
  }

  protected onLinkClick(event: Event): void {
    event.preventDefault();
    this.clicked.emit(this.link());
  }
}
