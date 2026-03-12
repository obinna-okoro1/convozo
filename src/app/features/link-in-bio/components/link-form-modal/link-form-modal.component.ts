/**
 * Link Form Modal Component
 * Presents a modal form for adding or editing a creator's link.
 * Handles URL validation, brand detection, form submission, and cancellation.
 */

import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreatorLink } from '../../../../core/models';
import { ToastService } from '../../../../shared/services/toast.service';
import { LinkService } from '../../services/link.service';
import { detectBrandKey, getBrandByKey, BrandInfo } from '../../utils/brand-detection';

@Component({
  selector: 'app-link-form-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './link-form-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkFormModalComponent {
  /** The creator ID (passed from parent) */
  public readonly creatorId = input.required<string>();

  /** The link being edited, or null for add mode */
  public readonly editingLink = input<CreatorLink | null>(null);

  /** The total number of links (for position calculation on new links) */
  public readonly totalLinkCount = input<number>(0);

  /** Emitted when form is successfully saved */
  public readonly onSaved = output<void>();

  /** Emitted when user closes/cancels the modal */
  public readonly onClosed = output<void>();

  // Form fields
  protected formUrl = '';
  protected formTitle = '';
  protected detectedBrand = signal<BrandInfo | null>(null);

  // UI state
  protected saving = signal(false);
  private brandCache = new Map<string, BrandInfo | null>();

  constructor(
    private readonly linkService: LinkService,
    private readonly toast: ToastService,
  ) {}

  /**
   * Detects the brand from the URL and updates the form UI
   */
  protected onUrlChange(url: string): void {
    if (!url.trim()) {
      this.detectedBrand.set(null);
      return;
    }

    const brandKey = detectBrandKey(url);
    if (brandKey) {
      let brand = this.brandCache.get(brandKey);
      if (!brand) {
        brand = getBrandByKey(brandKey) ?? null;
        this.brandCache.set(brandKey, brand);
      }
      this.detectedBrand.set(brand);
    } else {
      this.detectedBrand.set(null);
    }
  }

  /**
   * Saves the link (create or update)
   */
  protected async saveLink(): Promise<void> {
    if (this.saving()) return;

    const url = this.formUrl.trim();
    if (!url || !this.formTitle.trim()) {
      this.toast.error('Please fill in all fields');
      return;
    }

    this.saving.set(true);
    try {
      const creatorId = this.creatorId();
      const editingLink = this.editingLink();

      if (editingLink) {
        // Update existing link
        const { error } = await this.linkService.updateLink(editingLink.id, {
          title: this.formTitle.trim(),
          url,
          icon: this.detectedBrand()?.key ?? null,
        });
        if (error) {
          this.toast.error('Failed to update link');
        } else {
          this.toast.success('Link updated');
          this.onSaved.emit();
        }
      } else {
        // Create new link
        const position = this.totalLinkCount();
        const brandKey = this.detectedBrand()?.key ?? null;
        const { error } = await this.linkService.createLink(creatorId, {
          title: this.formTitle.trim(),
          url,
          icon: brandKey,
          position,
        });
        if (error) {
          this.toast.error('Failed to add link');
        } else {
          this.toast.success('Link added');
          this.onSaved.emit();
        }
      }
    } catch {
      this.toast.error('Something went wrong');
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Closes the modal
   */
  protected closeModal(): void {
    this.onClosed.emit();
  }
}
