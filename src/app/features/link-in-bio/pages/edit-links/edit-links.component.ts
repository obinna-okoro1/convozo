/**
 * Edit Links Component
 * Dashboard component for managing creator links (add, edit, delete, reorder, toggle).
 * Supports brand auto-detection from URL and drag-style reorder via up/down buttons.
 */

import { ChangeDetectionStrategy, Component, OnInit, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreatorLink } from '../../../../core/models';
import { ToastService } from '../../../../shared/services/toast.service';
import { LinkService } from '../../services/link.service';
import { detectBrandKey, getBrandByKey, BrandInfo } from '../../utils/brand-detection';

@Component({
  selector: 'app-edit-links',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './edit-links.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditLinksComponent implements OnInit {
  /** The creator ID passed in from the parent dashboard */
  public readonly creatorId = input.required<string>();

  protected readonly links = signal<CreatorLink[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly reordering = signal(false);
  protected readonly editingLink = signal<CreatorLink | null>(null);
  protected readonly detectedBrand = signal<BrandInfo | null>(null);
  protected readonly deletePendingId = signal<string | null>(null);

  // Form fields (simple two-way binding via ngModel)
  protected formTitle = '';
  protected formUrl = '';

  private brandCache = new Map<string, BrandInfo | null>();

  constructor(
    private readonly linkService: LinkService,
    private readonly toast: ToastService,
  ) {}

  public ngOnInit(): void {
    void this.loadLinks();
  }

  // ── URL change detection ──────────────────────────────────────────

  protected onUrlChange(url: string): void {
    if (!url.trim()) {
      this.detectedBrand.set(null);
      return;
    }

    // Ensure the URL has a protocol for detection
    let normalizedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      normalizedUrl = 'https://' + url;
    }

    const brandKey = detectBrandKey(normalizedUrl);
    if (brandKey) {
      const brand = getBrandByKey(brandKey);
      this.detectedBrand.set(brand);
      // Auto-fill title if empty and brand is detected
      if (!this.formTitle.trim() && brand) {
        this.formTitle = `My ${brand.label}`;
      }
    } else {
      this.detectedBrand.set(null);
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────

  protected async saveLink(): Promise<void> {
    if (!this.formTitle.trim() || !this.formUrl.trim()) {
      return;
    }

    this.saving.set(true);

    // Normalise URL
    let url = this.formUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const brandKey = detectBrandKey(url);
    const editing = this.editingLink();

    try {
      if (editing) {
        // Update existing link
        const { error } = await this.linkService.updateLink(editing.id, {
          title: this.formTitle.trim(),
          url,
          icon: brandKey,
        });
        if (error) {
          this.toast.error('Failed to update link');
        } else {
          this.toast.success('Link updated');
          this.cancelEdit();
          await this.loadLinks();
        }
      } else {
        // Create new link
        const position = this.links().length;
        const { error } = await this.linkService.createLink(this.creatorId(), {
          title: this.formTitle.trim(),
          url,
          icon: brandKey,
          position,
        });
        if (error) {
          this.toast.error('Failed to add link');
        } else {
          this.toast.success('Link added');
          this.resetForm();
          await this.loadLinks();
        }
      }
    } catch {
      this.toast.error('Something went wrong');
    } finally {
      this.saving.set(false);
    }
  }

  protected requestDelete(link: CreatorLink): void {
    this.deletePendingId.set(link.id);
  }

  protected cancelDelete(): void {
    this.deletePendingId.set(null);
  }

  protected async executeDelete(link: CreatorLink): Promise<void> {
    this.deletePendingId.set(null);
    const { error } = await this.linkService.deleteLink(link.id);
    if (error) {
      this.toast.error('Failed to delete link');
    } else {
      this.toast.success('Link deleted');
      await this.loadLinks();
    }
  }

  protected async toggleActive(link: CreatorLink): Promise<void> {
    const { error } = await this.linkService.updateLink(link.id, {
      is_active: !link.is_active,
    });
    if (error) {
      this.toast.error('Failed to update link');
    } else {
      // Update the local signal optimistically
      this.links.update((list) =>
        list.map((l) => (l.id === link.id ? { ...l, is_active: !l.is_active } : l)),
      );
    }
  }

  // ── Edit mode ─────────────────────────────────────────────────────

  protected startEdit(link: CreatorLink): void {
    this.editingLink.set(link);
    this.formTitle = link.title;
    this.formUrl = link.url;
    this.onUrlChange(link.url);
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancelEdit(): void {
    this.editingLink.set(null);
    this.resetForm();
  }

  // ── Reorder ───────────────────────────────────────────────────────

  protected async moveLink(index: number, direction: -1 | 1): Promise<void> {
    const current = [...this.links()];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= current.length) {
      return;
    }

    // Swap
    [current[index], current[targetIndex]] = [current[targetIndex], current[index]];

    // Update positions
    const reordered = current.map((link, i) => ({ ...link, position: i }));
    this.links.set(reordered);

    this.reordering.set(true);
    const { error } = await this.linkService.reorderLinks(
      reordered.map((l) => ({ id: l.id, position: l.position })),
    );
    this.reordering.set(false);

    if (error) {
      this.toast.error('Failed to reorder');
      await this.loadLinks(); // Revert
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────

  protected getLinkBrand(link: CreatorLink): BrandInfo | null {
    if (!link.icon) {
      return null;
    }
    if (this.brandCache.has(link.icon)) {
      return this.brandCache.get(link.icon)!;
    }
    const brand = getBrandByKey(link.icon);
    this.brandCache.set(link.icon, brand);
    return brand;
  }

  private async loadLinks(): Promise<void> {
    this.loading.set(true);
    const { data } = await this.linkService.getCreatorLinks(this.creatorId());
    this.links.set(data ?? []);
    this.loading.set(false);
  }

  private resetForm(): void {
    this.formTitle = '';
    this.formUrl = '';
    this.detectedBrand.set(null);
  }
}
