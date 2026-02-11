# Contributing to Convozo

Thank you for your interest in contributing to Convozo! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- A Supabase account (for backend development)
- A Stripe account (for payment testing)

### Development Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/convozo.git
   cd convozo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. Start the development server:
   ```bash
   npm start
   ```

## Project Structure

```
convozo/
├── src/app/
│   ├── auth/           # Authentication components
│   ├── creator/        # Creator dashboard and features
│   ├── public/         # Public-facing pages
│   └── shared/         # Shared services and utilities
├── supabase/
│   ├── migrations/     # Database migrations
│   └── functions/      # Edge Functions
└── docs/              # Documentation
```

## Development Workflow

### Branching Strategy

- `main` - Production-ready code
- `develop` - Development branch
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Critical production fixes

### Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Test your changes:
   ```bash
   npm run build
   npm start
   ```

4. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

6. Open a Pull Request

### Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add message filtering in dashboard
fix: resolve payment webhook signature validation
docs: update installation instructions
```

## Code Style

### TypeScript/Angular

- Use TypeScript strict mode
- Follow Angular style guide
- Use signals for reactive state
- Prefer standalone components
- Use async/await over promises

### CSS/Tailwind

- Use Tailwind utility classes
- Follow mobile-first approach
- Keep custom CSS minimal
- Use semantic color names

### Code Formatting

We use Prettier for code formatting:
```bash
npm run format
```

## Testing

### Running Tests

```bash
npm test
```

### Writing Tests

- Write unit tests for services
- Write component tests for complex logic
- Test edge cases and error conditions

Example:
```typescript
describe('SupabaseService', () => {
  it('should sign in with email', async () => {
    // Test implementation
  });
});
```

## Pull Request Guidelines

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] Tests pass
- [ ] Documentation is updated
- [ ] Commit messages follow convention
- [ ] No console.log statements
- [ ] No commented-out code

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
```

## Areas for Contribution

### High Priority

1. **Stripe Connect Onboarding**
   - Implement full Stripe Connect Express flow
   - Handle account verification
   - Manage payout schedules

2. **Email Service Integration**
   - Replace placeholder with actual email service
   - Implement email templates
   - Add email queuing

3. **Rate Limiting**
   - Implement rate limiting on message submission
   - Add IP-based throttling
   - Create abuse prevention mechanisms

4. **Content Moderation**
   - Add message content filtering
   - Implement reporting system
   - Integrate AI moderation

### Medium Priority

5. **Analytics Dashboard**
   - Revenue tracking
   - Message statistics
   - User engagement metrics

6. **Search and Filtering**
   - Search messages
   - Filter by date/amount/status
   - Tag system

7. **File Attachments**
   - Image uploads
   - Video messages
   - File storage integration

### Nice to Have

8. **Admin Panel**
   - User management
   - Platform statistics
   - Moderation tools

9. **Automated Responses**
   - Quick replies
   - Scheduled messages
   - Template system

10. **Mobile App**
    - React Native or Flutter
    - Push notifications
    - Camera integration

## Documentation

### Updating Documentation

When adding features, update:
- README.md (if setup changes)
- DEPLOYMENT.md (if deployment process changes)
- SECURITY.md (if security implications)
- Inline code comments
- API documentation

### Writing Good Documentation

- Be clear and concise
- Include code examples
- Add screenshots for UI features
- Update table of contents
- Test instructions yourself

## Reporting Bugs

### Bug Report Template

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Step one
2. Step two
3. ...

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- Browser: 
- OS: 
- Node version: 
- npm version: 

## Screenshots
If applicable

## Additional Context
Any other relevant information
```

## Feature Requests

### Feature Request Template

```markdown
## Feature Description
Clear description of the feature

## Use Case
Why is this feature needed?

## Proposed Solution
How might this be implemented?

## Alternatives Considered
Other approaches you've thought about

## Additional Context
Any other relevant information
```

## Security Issues

**DO NOT** create public issues for security vulnerabilities.

Instead:
1. Email security@convozo.com
2. Include details privately
3. Wait for acknowledgment
4. Allow time for fix before disclosure

## Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Give constructive feedback
- Focus on the issue, not the person
- Assume good intentions

### Communication Channels

- GitHub Issues - Bug reports and features
- GitHub Discussions - General questions
- Pull Requests - Code reviews

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Social media (with permission)

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

## Questions?

Feel free to:
- Open a GitHub Discussion
- Ask in Pull Request comments
- Reach out to maintainers

---

Thank you for contributing to Convozo! 🎉
