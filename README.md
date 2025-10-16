# Timeliner - Annotated Timeline Creator

A comprehensive NextJS application for creating and managing annotated timelines with events, entities, and locations. Features multi-user support, admin management, and interactive panels for timeline visualization.

![Sample Timeline](https://github.com/mike-r-karras/timeliner/blob/develop/timeline.png?raw=true)

![Connection Manager](https://github.com/mike-r-karras/timeliner/blob/develop/connection_manager.png?raw=true)

## Features

### Core Functionality
- **Multi-user Authentication**: Secure login system with user roles (admin/user)
- **Timeline Management**: Create and manage multiple timelines
- **Event Creation**: Add events with titles, descriptions, dates, importance ratings, and thumbnails
- **Entity Management**: Track people, organizations, locations, objects, and concepts
- **Location Integration**: Geo-located events with optional radius indicators
- **Interactive Interface**: Three resizable, dismissable panels (Map, Timeline, Entities)

### User Interface
- **Material Design**: Clean, professional UI using Material-UI components
- **Resizable Panels**: Drag to resize panel widths and reorder panels
- **Cross-Panel Selection**: Click events/entities in one panel to highlight in others
- **Timeline Scaling**: Zoom controls for timeline view
- **Search & Filter**: Search entities and filter by type

### Admin Features
- **User Management**: Create, edit, and delete user accounts
- **Role Management**: Assign admin or user roles
- **Password Management**: Change user passwords
- **Default Admin**: Pre-configured root/toor admin account

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Material-UI, React
- **Backend**: Next.js API Routes, NextAuth.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: NextAuth.js with credential provider
- **Styling**: Material-UI with custom theming

## Prerequisites

- Node.js 18+
- MongoDB (local or remote)
- npm or yarn

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup
Create a MongoDB database named `timeliner` with user credentials:
- Database: `timeliner`
- Username: `timeliner`
- Password: `renilemit`

Or update the connection string in `.env.local` to match your setup.

### 3. Environment Configuration
The `.env.local` file is already configured with:
```env
MONGODB_URI=mongodb://timeliner:renilemit@localhost:27017/timeliner
NEXTAUTH_SECRET=your-secret-key-change-in-production
NEXTAUTH_URL=http://localhost:3000
JWT_SECRET=your-jwt-secret-change-in-production
```

**Important**: Change the secret keys before deploying to production.

### 4. Run the Application
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Default Admin Account

- **Username**: `root`
- **Password**: `toor`

This account is automatically created when the application starts. Use it to access the admin panel and create additional users.

## Usage Guide

### Getting Started
1. Navigate to `http://localhost:3000`
2. Sign in with the default admin account (root/toor)
3. The application will create a default "Untitled" timeline
4. Use the + button to add your first event

### Creating Events
1. Click the + floating button in the bottom right
2. Select "Add Event"
3. Fill in event details:
   - Title (required)
   - Description (optional)
   - Start/End dates
   - Importance level (1-5 stars)
   - Location (optional)

### Managing Entities
1. Click the + floating button
2. Select "Add Entity"
3. Choose entity type (person, organization, location, etc.)
4. Add name and description

### Panel Management
- **Resize**: Drag the edges between panels to adjust widths
- **Reorder**: Drag the panel headers to reorder left to right
- **Dismiss**: Click the X button to hide panels
- **Restore**: Use panel controls to show hidden panels

### Admin Panel
Access via the user menu (top right) → Admin Panel:
- View all users
- Create new users
- Edit user roles and passwords
- Delete users (except your own account)

## Database Collections

The application uses the following MongoDB collections:

- **users**: User accounts and authentication data
- **timelines**: Timeline metadata and ownership
- **events**: Timeline events with dates, locations, and metadata
- **entities**: People, organizations, concepts linked to timelines
- **locations**: Geographic locations with coordinates and radius
- **attachments**: File attachments for events (photos, documents, etc.)
- **connections**: Relationships between events and entities

## API Endpoints

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth authentication

### Admin
- `GET /api/admin/users` - List all users (admin only)
- `POST /api/admin/users` - Create new user (admin only)
- `PATCH /api/admin/users/[id]` - Update user (admin only)
- `DELETE /api/admin/users/[id]` - Delete user (admin only)

### Timelines
- `GET /api/timelines` - Get user's timelines
- `POST /api/timelines` - Create new timeline
- `GET /api/timelines/current` - Get current timeline
- `PATCH /api/timelines/[id]` - Update timeline
- `DELETE /api/timelines/[id]` - Delete timeline

### Events
- `GET /api/events?timelineId={id}` - Get timeline events
- `POST /api/events` - Create new event
- `PATCH /api/events/[id]` - Update event
- `DELETE /api/events/[id]` - Delete event

### Entities
- `GET /api/entities?timelineId={id}` - Get timeline entities
- `POST /api/entities` - Create new entity
- `PATCH /api/entities/[id]` - Update entity
- `DELETE /api/entities/[id]` - Delete entity

### Locations
- `GET /api/locations` - Get user's locations
- `POST /api/locations` - Create new location

## Future Enhancements

The application is designed to support additional features:

- **Map Integration**: Interactive map with Leaflet showing event locations
- **File Attachments**: Upload and manage photos, videos, documents
- **Advanced Connections**: Link events to entities with relationship types
- **Timeline Export**: Export timelines to various formats
- **Collaborative Features**: Share timelines with other users
- **Advanced Filtering**: Filter events by date ranges, importance, etc.
- **Data Import**: Import timeline data from external sources

## Contributing

This application provides a solid foundation for timeline management. Key areas for extension:

1. **Map Integration**: Implement Leaflet map with location pins
2. **File Upload**: Add multer-based file attachment system
3. **Advanced UI**: Enhanced timeline visualization and interactions
4. **Data Visualization**: Charts and graphs for timeline analytics
5. **Export Features**: PDF, CSV, and other export formats

## License

This project is provided as a foundation for timeline applications. Modify and extend as needed for your specific requirements.