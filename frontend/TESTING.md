# Testing Documentation

## Overview

This document provides comprehensive information about testing the SMALDA Legal Report Export Page and related components.

## Test Structure

### Test Files
- `__tests__/legal-report.test.js` - Main test file for Legal Report functionality
- `jest.config.js` - Jest configuration
- `jest.setup.js` - Test environment setup
- `test-runner.js` - Custom test runner script

## Running Tests

### Using npm scripts
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Using the custom test runner
```bash
# Run unit tests for Legal Report page
node test-runner.js unit

# Run all tests with coverage
node test-runner.js coverage

# Run tests in watch mode
node test-runner.js watch

# Run all tests
node test-runner.js all

# Show help
node test-runner.js help
```

## Test Coverage

### Legal Report Page Tests

#### Page Rendering Tests
- ✅ Main page title rendering
- ✅ Page description rendering
- ✅ Back to dashboard button
- ✅ Export PDF button

#### Document Information Tests
- ✅ Document information card rendering
- ✅ Document title display
- ✅ Document type display
- ✅ Document number display
- ✅ Upload date display
- ✅ File size display

#### Analysis Summary Tests
- ✅ Analysis summary card rendering
- ✅ Overall risk level display
- ✅ Confidence percentage display
- ✅ Processing time display
- ✅ AI model version display

#### Property Details Tests
- ✅ Property details card rendering
- ✅ Property location display
- ✅ Property area display
- ✅ Zoning information display
- ✅ Assessed value display

#### Detailed Findings Tests
- ✅ Detailed findings card rendering
- ✅ Verification finding display
- ✅ Ownership finding display
- ✅ Boundaries finding display
- ✅ Encumbrances finding display
- ✅ Compliance finding display

#### Recommendations Tests
- ✅ Recommendations card rendering
- ✅ All recommendations display

#### Risk Level Indicators Tests
- ✅ Risk level color coding (LOW/Green, MEDIUM/Yellow, HIGH/Red)
- ✅ Status icons (PASSED/CheckCircle, WARNING/AlertTriangle)

#### Footer Information Tests
- ✅ Generation timestamp display
- ✅ Support contact information

### PdfExportButton Component Tests

#### Component Rendering Tests
- ✅ Default text rendering
- ✅ Custom text rendering
- ✅ Download icon rendering

#### Button States Tests
- ✅ Default enabled state
- ✅ Loading state during export
- ✅ Disabled state during export

#### PDF Generation Tests
- ✅ jsPDF constructor calls
- ✅ Correct filename generation
- ✅ Error handling for PDF generation failures

#### Data Handling Tests
- ✅ Empty data handling
- ✅ Null data handling
- ✅ Legal report data structure handling

#### Component Props Tests
- ✅ Custom className application
- ✅ Custom variant application
- ✅ Custom size application

### Integration Tests
- ✅ Complete user flow from page load to PDF export
- ✅ Navigation links functionality

## Test Dependencies

### Required Packages
```json
{
  "@testing-library/jest-dom": "^6.1.4",
  "@testing-library/react": "^14.1.2",
  "@testing-library/user-event": "^14.5.1",
  "jest": "^29.7.0",
  "jest-environment-jsdom": "^29.7.0"
}
```

### Mocked Dependencies
- `jspdf` - PDF generation library
- `next/navigation` - Next.js router
- `next/link` - Next.js Link component
- `window.alert` - Browser alert function
- `window.matchMedia` - Media queries
- `ResizeObserver` - Element resize observation

## Test Configuration

### Jest Configuration (`jest.config.js`)
- Uses Next.js Jest configuration
- JSDOM test environment
- Custom module name mapping for `@/` imports
- Coverage collection from app and components directories
- 70% coverage threshold for all metrics

### Test Setup (`jest.setup.js`)
- Imports `@testing-library/jest-dom` matchers
- Mocks global browser APIs
- Configures ResizeObserver mock

## Writing New Tests

### Component Test Structure
```javascript
describe('Component Name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Feature Category', () => {
    test('should do something specific', () => {
      // Arrange
      render(<Component />);
      
      // Act
      fireEvent.click(screen.getByText('Button'));
      
      // Assert
      expect(screen.getByText('Expected Result')).toBeInTheDocument();
    });
  });
});
```

### Testing Best Practices

#### 1. Test Organization
- Group related tests using `describe` blocks
- Use descriptive test names that explain the expected behavior
- Follow the Arrange-Act-Assert pattern

#### 2. Component Testing
- Test component rendering
- Test user interactions
- Test prop variations
- Test error states
- Test loading states

#### 3. Mocking
- Mock external dependencies
- Mock browser APIs
- Mock async operations
- Use realistic mock data

#### 4. Assertions
- Use specific assertions
- Test both positive and negative cases
- Verify error handling
- Check accessibility attributes

## Coverage Reports

### Running Coverage
```bash
npm run test:coverage
```

### Coverage Metrics
- **Branches**: 70% minimum
- **Functions**: 70% minimum
- **Lines**: 70% minimum
- **Statements**: 70% minimum

### Coverage Files
- `coverage/lcov-report/index.html` - HTML coverage report
- `coverage/lcov.info` - LCOV format coverage data

## Debugging Tests

### Common Issues

#### 1. Import Errors
- Ensure module name mapping is correct
- Check file paths and extensions
- Verify Jest configuration

#### 2. Mock Issues
- Clear mocks between tests using `jest.clearAllMocks()`
- Ensure mocks are defined before component rendering
- Check mock implementation matches expected interface

#### 3. Async Test Issues
- Use `waitFor` for async operations
- Properly mock async functions
- Handle Promise rejections

#### 4. DOM Testing Issues
- Use `@testing-library` queries
- Avoid testing implementation details
- Focus on user behavior

### Debug Commands
```bash
# Run specific test file
npm test legal-report.test.js

# Run tests with verbose output
npm test -- --verbose

# Run tests with debug logging
DEBUG=* npm test

# Run single test
npm test -- -t "test name"
```

## Continuous Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## Maintenance

### Regular Tasks
1. **Update Dependencies**: Keep testing libraries up to date
2. **Review Coverage**: Ensure coverage thresholds are met
3. **Refactor Tests**: Remove redundant or outdated tests
4. **Add New Tests**: Cover new features and edge cases

### Test Data Management
- Keep mock data realistic and up to date
- Use consistent data structures
- Document data relationships
- Version control test data changes

## Troubleshooting

### Common Error Messages

#### "Cannot find module"
- Check import paths
- Verify Jest module mapping
- Ensure files exist

#### "Test environment setup"
- Check Jest configuration
- Verify setup file path
- Ensure all mocks are defined

#### "Async operation timeout"
- Increase timeout for long-running tests
- Use proper async/await patterns
- Mock external API calls

### Getting Help
1. Check Jest documentation
2. Review Testing Library guides
3. Search existing test files for patterns
4. Consult team members for complex scenarios

## Future Enhancements

### Planned Improvements
- [ ] Add E2E tests with Playwright
- [ ] Implement visual regression testing
- [ ] Add performance testing
- [ ] Create test data factories
- [ ] Add accessibility testing

### Test Automation
- [ ] Automated test generation
- [ ] Coverage trend analysis
- [ ] Test performance monitoring
- [ ] Automated test maintenance 