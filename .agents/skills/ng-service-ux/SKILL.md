---
name: ng-service-ux
description: Defines loading, success, error, confirmation, and async interaction conventions. Use when implementing a user-triggered asynchronous operation.
---
# Service UX

Every user-triggered operation displays loading, success, and error. Render all three states, use inline loaders for submit buttons, show API errors inline, and reserve toasts for success or information. Destructive actions require a confirmation service returning `Promise<boolean>`.
