import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-delete-confirm-modal',
  templateUrl: './delete-confirm-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteConfirmModalComponent {
  public readonly isMessage = input.required<boolean>();
  public readonly itemName = input.required<string>();
  public readonly deleting = input.required<boolean>();

  public readonly confirmed = output();
  public readonly cancelled = output();
}
