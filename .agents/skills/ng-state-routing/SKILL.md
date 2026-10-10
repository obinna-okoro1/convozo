---
name: ng-state-routing
description: Defines lazy Angular routes, route state scope, titles, preloading, guards, and breadcrumb metadata. Use when creating or changing routes.
---
# State and routing

Lazy-load each feature, keep route constants centralized, scope slice providers to routes, use `canMatch` before lazy routes, and add titles. Parameter routes carry a breadcrumb label when breadcrumb UI exists. State services remain within the routed subtree that initializes them.
