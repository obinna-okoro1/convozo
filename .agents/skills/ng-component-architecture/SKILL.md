---
name: ng-component-architecture
description: Chooses smart and dumb Angular component responsibilities and change detection. Use when designing a component or refactoring component boundaries.
---
# Component architecture

Routed components and independent route areas are smart: they own state and service loading, use signals, have no inputs or outputs, and use default change detection. Other components are dumb: input/output only, no data-service injection or visibility decisions, `OnPush`, and pure pipes for row transforms. Shared domain widgets receive entities through input and never inject screen state.
