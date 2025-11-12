# Claude Development Notes

## Project Context
This is a Next.js application for managing event attendees and seat assignments. The app integrates with:
- **CrunchyBridge PostgreSQL** database (staging cluster: `squadup-staging`)
- **Clerk Authentication** for secure access
- **Shadcn UI components** for modern interface

**Current Functionality**: Displays all attendees for host user ID 9835080 with their seat assignments and validation timestamps in a table format.

## Important Files to Maintain

### 📋 Always Update These Files
1. **`todos.md`** - Comprehensive development log and task tracking
   - Document all new features and fixes
   - Include technical implementation details
   - Track known issues and future enhancements
   - Update after every significant change

2. **`DATABASE_SETUP.md`** - Database configuration guide
   - Update when database schema changes
   - Include new connection requirements
   - Document new environment variables

3. **`.env.local`** - Environment configuration
   - Keep staging/production settings clear
   - Document API endpoint changes needed for production
   - Maintain security best practices

## Current Architecture

### Database Layer (`lib/db.ts`)
- **Connection**: Read-only PostgreSQL via CrunchyBridge
- **Key Tables**: `events`, `event_attendees`, `users`, `attendee_guests`
- **Relationships**: events → event_attendees → attendee_guests
- **Important Columns**:
  - `event_attendees`: first_name, last_name, deleted_at
  - `attendee_guests`: seat_id, seat_obj (jsonb), checkin_timestamp
- **Security**: SSL required, connection pooling, read-only transactions

### API Layer
- **Route**: `/api/attendees-list` - Main endpoint for fetching all attendees with seat info
- **Route**: `/api/seat-lookup` - Legacy search-based seat lookup (deprecated)
- **Route**: `/api/query-transactions` - Legacy transaction query endpoint
- **Route**: `/api/fetch-zip` - Legacy manual ZIP extraction

### Frontend (`app/dashboard/page.tsx`)
- **UI Framework**: Tailwind CSS + Shadcn components
- **State Management**: React hooks
- **Components**: Responsive table, toast notifications, loading states
- **Features**: Auto-load on mount, refresh button, formatted timestamps

## Development Workflow

### Before Making Changes
1. ✅ Read `todos.md` to understand current state
2. ✅ Check environment settings in `.env.local`
3. ✅ Review database schema if touching data layer
4. ✅ Test with staging environment first

### After Making Changes
1. ✅ Update `todos.md` with new features/fixes
2. ✅ Run `npm run lint` to ensure code quality
3. ✅ Test critical user paths
4. ✅ Update documentation if API or schema changes
5. ✅ Commit with descriptive messages

## Critical Configuration

### Environment Variables
```env
# Database (current)
DATABASE_URL=postgres://application:...@p.7z2doxleybbkxl4v5mwgruubeq.db.postgresbridge.com:5431/postgres

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Legacy (may be removed in future)
WORLDPAY_API_KEY=a708d763b5c3cad415693f2010a647cb
```

### Required Updates for Production
1. Switch to production database connection
2. Update Vercel environment variables
3. Verify Clerk authentication keys for production

## Security Notes
- ✅ Database access is read-only
- ✅ API keys stored in environment variables
- ✅ SSL connections required
- ✅ Clerk authentication protects all routes
- ✅ Input validation and sanitization implemented

## Common Issues & Solutions

### Database Connection Issues
- **Issue**: SSL or authentication failures
- **Solution**: Verify CrunchyBridge credentials and SSL settings

### Empty Seat Info
- **Issue**: Some attendees show "-" for seat info
- **Solution**: These attendees may not have seat assignments yet (attendee_guests or tickets not created)

### Check-in Timestamps
- **Issue**: Some "Validated At" fields show "-"
- **Solution**: These attendees haven't been checked in yet (attendee_guests.checkin_timestamp is NULL)
- **Note**: The timestamp column is called `checkin_timestamp`, not `validated_at`

## Performance Considerations
- Database queries use proper JOINs and indexing
- LEFT JOINs allow showing attendees even without seat assignments
- Frontend auto-loads data on mount
- Connection pooling prevents resource exhaustion
- Table displays all results without pagination (suitable for current data volume)

## Monitoring & Maintenance
- Track database query performance
- Review error logs regularly
- Keep dependencies updated
- Monitor attendee count and ensure query performance scales appropriately

---

**Remember**: Always update `todos.md` after significant changes to maintain project continuity!