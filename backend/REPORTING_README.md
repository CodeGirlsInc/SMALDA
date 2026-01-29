# Reporting and Analytics Module

## Overview

A comprehensive reporting and analytics system for generating various reports, analytics, and exports for documents, users, and system activity. This module provides automated report generation, scheduling, caching, and multiple export formats.

## Features

✅ **Report Generation**
- Document verification reports with transaction details
- User activity and engagement reports
- System-wide analytics and performance metrics
- Custom date range filtering
- Multiple export formats (PDF, CSV, Excel, JSON)

✅ **Report Templates**
- Pre-configured system templates
- Custom template creation
- Configurable columns, charts, and filters
- Template versioning and management

✅ **Scheduled Reports**
- Daily, weekly, and monthly scheduling
- Custom cron expressions
- Email delivery to recipients
- Automatic retry on failure
- Schedule history tracking

✅ **Analytics & Metrics**
- Real-time document verification analytics
- User growth and activity trends
- Network and status distribution
- Peak usage hours analysis
- Risk assessment trends

✅ **Performance Optimization**
- Query result caching (5-minute TTL)
- Efficient database indexing
- Pagination support
- Background job processing

## Architecture

```
reporting/
├── entities/
│   ├── report.entity.ts              # Report records
│   ├── report-template.entity.ts     # Report templates
│   └── report-schedule.entity.ts     # Scheduled reports
├── dto/
│   ├── generate-report.dto.ts        # Report generation input
│   ├── report-filter.dto.ts          # Query filters
│   ├── schedule.dto.ts               # Schedule management
│   └── template.dto.ts               # Template management
├── services/
│   ├── reporting.service.ts          # Core report logic
│   ├── analytics.service.ts          # Analytics calculations
│   ├── pdf-export.service.ts         # PDF generation
│   ├── excel-export.service.ts       # Excel/CSV generation
│   ├── cache.service.ts              # Caching layer
│   ├── schedule.service.ts           # Report scheduling
│   └── template.service.ts           # Template management
├── reporting.controller.ts           # API endpoints
└── reporting.module.ts               # Module configuration
```

## API Endpoints

### Reports

#### Generate Report
```http
POST /reports
Authorization: Bearer <token>

{
  "title": "Monthly Document Verification Report",
  "description": "Report for January 2026",
  "type": "document_verification",
  "format": "pdf",
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "filters": {
    "status": "success",
    "network": "testnet"
  }
}
```

#### List Reports
```http
GET /reports?page=1&limit=10&type=document_verification&status=completed
Authorization: Bearer <token>
```

#### Get Report
```http
GET /reports/:id
Authorization: Bearer <token>
```

#### Download Report
```http
GET /reports/:id/download
Authorization: Bearer <token>
```

#### Delete Report
```http
DELETE /reports/:id
Authorization: Bearer <token>
```

### Templates

#### List Templates
```http
GET /reports/templates
Authorization: Bearer <token>
```

#### Create Template (Admin Only)
```http
POST /reports/templates
Authorization: Bearer <token>

{
  "name": "Custom Report Template",
  "description": "Custom verification report",
  "type": "document_verification",
  "supportedFormats": ["pdf", "excel", "csv"],
  "config": {
    "columns": ["transactionHash", "documentHash", "status"],
    "charts": ["verifications_per_day"],
    "filters": ["dateRange", "status"]
  }
}
```

#### Update Template (Admin Only)
```http
PUT /reports/templates/:id
Authorization: Bearer <token>

{
  "name": "Updated Template Name",
  "isActive": true
}
```

### Schedules

#### Create Schedule
```http
POST /reports/schedules
Authorization: Bearer <token>

{
  "name": "Weekly Verification Report",
  "description": "Automated weekly report",
  "templateId": "template-uuid",
  "frequency": "weekly",
  "recipients": ["admin@example.com", "manager@example.com"],
  "filters": {
    "status": "success"
  }
}
```

#### List Schedules
```http
GET /reports/schedules
Authorization: Bearer <token>
```

#### Update Schedule
```http
PUT /reports/schedules/:id
Authorization: Bearer <token>

{
  "frequency": "daily",
  "isActive": true
}
```

#### Toggle Schedule
```http
PATCH /reports/schedules/:id/toggle
Authorization: Bearer <token>
```

#### Delete Schedule
```http
DELETE /reports/schedules/:id
Authorization: Bearer <token>
```

## Report Types

### 1. Document Verification Report
Comprehensive report of all document verifications with transaction details, success rates, and trends.

**Includes:**
- Total verifications count
- Success/failure rates
- Average processing time
- Verifications per day chart
- Risk trends analysis
- Detailed transaction list

**Formats:** PDF, Excel, CSV

### 2. User Activity Report
User engagement and activity metrics showing growth trends and active users.

**Includes:**
- Total and active users
- New user statistics (today, week, month)
- User growth trends
- Most active users list
- Activity patterns

**Formats:** PDF, Excel

### 3. System Analytics Report
System-wide performance and operational metrics.

**Includes:**
- Total transactions
- Transaction volume trends
- Average transaction fees
- Network distribution
- Status distribution
- Peak usage hours

**Formats:** PDF, Excel

## Database Schema

### Report Entity
```typescript
{
  id: UUID
  title: string
  description?: string
  type: enum (document_verification, user_activity, system_analytics, custom)
  format: enum (pdf, csv, excel, json)
  status: enum (pending, processing, completed, failed)
  userId: UUID
  filters?: JSON
  data?: JSON
  filePath?: string
  fileSize?: number
  startDate?: Date
  endDate?: Date
  errorMessage?: string
  generationTimeMs: number
  isScheduled: boolean
  templateId?: UUID
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}
```

### ReportTemplate Entity
```typescript
{
  id: UUID
  name: string
  description?: string
  type: enum
  supportedFormats: enum[]
  config: JSON {
    columns?: string[]
    charts?: any[]
    filters?: any[]
    styling?: any
    layout?: string
  }
  queryTemplate?: string
  isActive: boolean
  isSystem: boolean
  createdBy?: UUID
  createdAt: Date
  updatedAt: Date
}
```

### ReportSchedule Entity
```typescript
{
  id: UUID
  name: string
  description?: string
  userId: UUID
  templateId: UUID
  frequency: enum (daily, weekly, monthly, custom)
  cronExpression?: string
  filters?: JSON
  recipients: string[]
  isActive: boolean
  lastRunAt?: Date
  nextRunAt?: Date
  runCount: number
  failureCount: number
  lastError?: string
  createdAt: Date
  updatedAt: Date
}
```

## Caching Strategy

The module implements an in-memory caching layer to optimize expensive analytics queries:

- **Default TTL:** 5 minutes (300 seconds)
- **Cache Keys:** Generated from query parameters
- **Automatic Expiration:** Expired entries are cleaned periodically
- **Cache Invalidation:** Manual reset capability

Example:
```typescript
// Analytics results cached for 10 minutes
const analytics = await cacheService.wrap(
  'analytics:doc-verification:2026-01',
  async () => await analyticsService.getDocumentAnalytics(start, end),
  600
);
```

## Scheduling

Reports can be scheduled to run automatically:

### Frequency Options
- **Daily:** Runs every 24 hours
- **Weekly:** Runs every 7 days
- **Monthly:** Runs on the same day each month
- **Custom:** Use cron expression for complex schedules

### Schedule Execution
- Runs hourly via `@Cron` decorator
- Checks for due schedules
- Generates reports asynchronously
- Updates next run time
- Tracks success/failure counts
- Stores error messages

## Testing

### Unit Tests
```bash
npm test -- reporting.service.spec.ts
```

Tests include:
- Report generation (all types and formats)
- Error handling
- Pagination
- CRUD operations
- Template management
- Schedule management

### E2E Tests
```bash
npm run test:e2e -- reporting.e2e-spec.ts
```

Comprehensive end-to-end tests covering:
- Authentication
- Report generation workflow
- Template CRUD
- Schedule CRUD
- File download
- Error scenarios

## Configuration

### Environment Variables
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=smalda

# File Storage
REPORTS_DIR=./reports

# Scheduling
SCHEDULE_CHECK_INTERVAL=3600000  # 1 hour in ms
```

### Module Configuration
```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([...]),
    ScheduleModule.forRoot(),
  ],
  // ...
})
export class ReportingModule implements OnModuleInit {
  async onModuleInit() {
    // Seeds default templates on startup
    await this.templateService.seedDefaultTemplates();
  }
}
```

## Performance Considerations

1. **Indexing**
   - Reports indexed by userId, createdAt, type, status
   - Templates indexed by type, isActive
   - Schedules indexed by userId, nextRunAt, isActive

2. **Pagination**
   - All list endpoints support pagination
   - Default: 10 items per page
   - Max: 100 items per page

3. **Caching**
   - Analytics queries cached for 5-10 minutes
   - Template metadata cached
   - Reduces database load significantly

4. **Async Processing**
   - Report generation runs asynchronously
   - Status tracking (pending → processing → completed/failed)
   - Background cleanup of old reports

## Security

- **Authentication Required:** All endpoints require JWT token
- **Role-Based Access:** Template management restricted to admins
- **User Isolation:** Users can only access their own reports
- **File Access Control:** Report downloads validated by ownership
- **Input Validation:** All DTOs validated using class-validator

## Error Handling

The module provides comprehensive error handling:

- **Report Generation Failures:** Captured and stored in report record
- **File System Errors:** Handled gracefully with proper logging
- **Database Errors:** Transaction rollback on failures
- **Schedule Failures:** Error count tracking with retry logic

## Future Enhancements

Potential improvements:
- [ ] Email delivery for scheduled reports
- [ ] Real-time report generation progress
- [ ] Report sharing and permissions
- [ ] Custom SQL query builder for templates
- [ ] Data visualization and charts in PDFs
- [ ] Report versioning and history
- [ ] Export to more formats (Word, JSON, XML)
- [ ] Report comparison and diff
- [ ] AI-powered insights and recommendations
- [ ] Multi-tenant support

## Troubleshooting

### Reports Stuck in Processing
Check:
1. Database connection
2. File system permissions for reports directory
3. Service logs for errors
4. Restart the application

### Schedules Not Running
Check:
1. ScheduleModule is imported
2. Cron jobs are enabled
3. Schedule `isActive` is true
4. `nextRunAt` is in the past
5. Check service logs

### PDF Generation Fails
Check:
1. PDFKit dependencies installed
2. Reports directory exists and is writable
3. Sufficient disk space
4. Check error message in report record

## Contributing

When contributing to the reporting module:
1. Follow existing code structure
2. Add unit tests for new features
3. Update E2E tests
4. Document new endpoints in README
5. Use proper TypeScript types
6. Follow NestJS best practices

## License

This module is part of the Smalda project and follows the same license.
