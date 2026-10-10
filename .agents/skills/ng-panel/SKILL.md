---
name: ng-panel
description: Defines Convozo Angular structure, standalone APIs, DI, selectors, imports, styling, and shared pieces. Use when creating or moving Angular code.
---
# Angular conventions

Use standalone declarations without `standalone: true`, and list only template imports. Inject through `private readonly value = inject(Token)`. Use signal `input` and `output`; parent state stays in the parent. Use `@if`, `@for`, and `@switch`, semantic selectors, SCSS per component, and no inline styles or `!important`. Place code in features, shared/domain, shared/ui, or shared/util according to ownership.
