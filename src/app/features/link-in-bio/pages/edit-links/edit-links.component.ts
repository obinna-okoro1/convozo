/**
 * Edit Links Component
 * Dashboard component for managing creator links (add, edit, delete, reorder, toggle).
 * Supports brand auto-detection from URL and drag-style reorder via up/down buttons.
 * Uses a modal form for adding/editing links.
 */

import { ChangeDetectionStrategy, Component, OnInit, input, signal } from '@angular/core';
import { CreatorLink } from '@core/models';
import { ToastService } from '@shared/services/toast.service';
import { LinkService } from '../../services/link.service';
import { LinkFormModalComponent } from '../../components/link-form-modal/link-form-modal.component';
import { getBrandByKey, BrandInfo } from '../../utils/brand-detection';

@Component({
  selector: 'app-edit-links',
  standalone: true,
  imports: [LinkFormModalComponent],
  templateUrl: './edit-links.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditLinksComponent implements OnInit {
  /** The creator ID passed in from the parent dashboard */
  public readonly creatorId = input.required<string>();

  protected readonly links = signal<CreatorLink[]>([]);
  protected readonly loading = signal(true);
  protected readonly reordering = signal(false);
  protected readonly showFormModal = signal(false);
  protected readonly editingLink = signal<CreatorLink | null>(null);
  protected readonly deletePendingId = signal<string | null>(null);

  private brandCache = new Map<string, BrandInfo | null>();

  constructor(
    private readonly linkService: LinkService,
    private readonly toast: ToastService,
  ) {}

  public ngOnInit(): void {
    void this.loadLinks();
  }

  // ── Modal management ──────────────────────────────────────────────

  protected openAddLinkModal(): void {
    this.editingLink.set(null);
    this.showFormModal.set(true);
  }

  protected openEditLinkModal(link: CreatorLink): void {
    this.editingLink.set(link);
    this.showFormModal.set(true);
  }

  protected closeFormModal(): void {
    this.showFormModal.set(false);
    this.editingLink.set(null);
  }

  protected async onLinkSaved(): Promise<void> {
    this.closeFormModal();
    await this.loadLinks();
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
}
