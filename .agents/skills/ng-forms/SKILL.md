---
name: ng-forms
description: Defines typed Reactive Forms ownership, factories, validators, submission, and rendering. Use when adding or changing a user-editable form.
---
# Forms

Use typed Reactive Forms, one owner component, and a separate form interface. A factory service creates controls and validators. The owner owns submit, errors, and saving state; children receive controls or forms by required input and never patch them. Guard submits with `if (form.invalid) return;`, use `getRawValue`, and test form behaviour.
