Technical Specification: TimeTrack App
Target AI Tool: Claude Code
Architecture: Monorepo / Full-Stack Next.js (App Router)
Primary Language: TypeScript

1. Tech Stack & Dependencies
Framework: Next.js 14+ (App Router, Server Actions)

Language: TypeScript (Strict mode enabled)

Styling: Tailwind CSS + shadcn/ui component library

Database & ORM: PostgreSQL + Prisma ORM

Authentication: Auth.js (NextAuth.js v5) or Clerk

State Management: Zustand (for active timer state & calendar view filters)

Date Utilities: date-fns, date-fns-tz, rrule (for recurring events)

Drag-and-Drop: @dnd-kit/core or react-big-calendar / custom SVG/CSS grid

Data Visualization: recharts (for analytics charts)

Icons: lucide-react

2. System Architecture & Directory Structure
code
Text
timetrack/
├── prisma/
│   └── schema.prisma         # Database schema
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (auth)/           # Login, Register pages
│   │   ├── (dashboard)/      # Authenticated routes
│   │   │   ├── calendar/     # Main Calendar View (Day, Week, Month, Year)
│   │   │   ├── analytics/    # Analytics & Comparison Dashboard
│   │   │   ├── categories/   # Category Management
│   │   │   └── page.tsx      # Dashboard redirect
│   │   ├── api/              # API routes (if needed alongside Server Actions)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── calendar/         # Grid, DayView, WeekView, EventCard, TimerWidget
│   │   ├── analytics/        # Charts, Variance Breakdown, Insight Cards
│   │   ├── categories/       # Color picker, Category List/Modal
│   │   ├── ui/               # shadcn/ui components (Button, Dialog, Select, etc.)
│   │   └── providers.tsx     # Session, Query, Theme providers
│   ├── lib/
│   │   ├── db.ts             # Prisma client instance
│   │   ├── rrule-utils.ts    # Recurrence engine helpers
│   │   ├── analytics-utils.ts# Variance and adherence calculation logic
│   │   └── time-utils.ts     # Date formatting and timezone tools
│   ├── store/
│   │   ├── use-timer.ts      # Zustand store for live stopwatch/timer
│   │   └── use-calendar.ts   # Zustand store for selected dates/views/filters
│   └── types/
│       └── index.ts          # Shared TypeScript interfaces
├── package.json
└── tsconfig.json
3. Database Schema (prisma/schema.prisma)
code
Prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum EventLayer {
  PLANNED
  ACTUAL
}

enum RecurrenceFrequency {
  ONCE
  DAILY
  WEEKLY
  MONTHLY
  CUSTOM
}

model User {
  id            String     @id @default(cuid())
  email         String     @unique
  name          String?
  image         String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  categories    Category()
  events        TimeEvent()
}

model Category {
  id          String      @id @default(cuid())
  userId      String?     // NULL means default global category
  user        User?       @relation(fields: [userId], references: id, onDelete: Cascade)
  name        String
  color       String      // Hex code e.g. "#2196F3"
  icon        String?     // Lucide icon name or emoji
  isDefault   Boolean     @default(false)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  events      TimeEvent()

  @@index([userId])
}

model TimeEvent {
  id            String              @id @default(cuid())
  userId        String
  user          User                @relation(fields: [userId], references: id, onDelete: Cascade)
  categoryId    String
  category      Category            @relation(fields: [categoryId], references: id)
  
  title         String
  description   String?             @db.Text
  layer         EventLayer          // PLANNED vs ACTUAL
  
  startTime     DateTime
  endTime       DateTime
  duration      Int                 // Stored in minutes for fast aggregation

  // Link actual time back to a specific planned event (optional)
  linkedPlannedId String?
  linkedPlanned   TimeEvent?        @relation("PlannedToActual", fields: [linkedPlannedId], references: [id], onDelete: SetNull)
  actualLogs      TimeEvent[]       @relation("PlannedToActual")

  // Recurrence Fields
  frequency     RecurrenceFrequency @default(ONCE)
  rruleString   String?             // iCal RRULE format (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR")
  recurrenceEnd DateTime?
  parentEventId String?             // For generated recurring instances
  
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  @@index([userId, startTime, endTime])
  @@index([userId, layer])
}
4. TypeScript Core Interfaces (src/types/index.ts)
code
TypeScript
export type EventLayer = 'PLANNED' | 'ACTUAL';
export type CalendarViewMode = 'day' | 'week' | 'month' | 'year';
export type ViewFilterMode = 'BOTH' | 'PLANNED_ONLY' | 'ACTUAL_ONLY';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  isDefault: boolean;
  userId?: string;
}

export interface TimeEvent {
  id: string;
  userId: string;
  categoryId: string;
  category: Category;
  title: string;
  description?: string;
  layer: EventLayer;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  linkedPlannedId?: string;
  frequency: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  rruleString?: string;
}

export interface CategoryAnalytics {
  categoryId: string;
  categoryName: string;
  color: string;
  plannedMinutes: number;
  actualMinutes: number;
  varianceMinutes: number; // actual - planned
  variancePercentage: number;
}

export interface AnalyticsSummary {
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  adherenceScore: number; // 0 - 100%
  breakdown: CategoryAnalytics[];
}
5. Core Algorithmic Logic Specs
5.1 Recurrence Engine (src/lib/rrule-utils.ts)
Use the rrule npm package to expand base events across the requested viewing window ([viewStart, viewEnd]).

When querying events for a week/month, query single non-recurring events + base recurring events, then expand recurring events dynamically in memory to prevent database bloating.

5.2 Plan Adherence & Variance Engine (src/lib/analytics-utils.ts)
Create a pure function calculateAnalytics(events: TimeEvent[], dateRange: { start: Date, end: Date }): AnalyticsSummary that:

Filters PLANNED and ACTUAL events within dateRange.

Groups total duration (minutes) by categoryId for both layers.

Computes Variance: 
Variance
=
Actual Minutes
−
Planned Minutes
Variance=Actual Minutes−Planned Minutes
.

Computes Adherence Score:
Adherence Score (%)
=
(
1
−
∑
∣
Planned
i
−
Actual
i
∣
∑
Planned
i
+
∑
Actual
i
)
×
100
Adherence Score (%)=(1− 
∑Planned 
i
​
 +∑Actual 
i
​
 
∑∣Planned 
i
​
 −Actual 
i
​
 ∣
​
 )×100

Generates human-readable feedback (e.g., "Underestimated Work by 3.5 hrs").

5.3 Dual-Layer Rendering Engine
Grid columns represent time slots (e.g., 15-min or 1-hour blocks).

Each time slot has 2 sub-tracks:

Track A (Left / Translucent / Striped Border): Planned Events.

Track B (Right / Solid Color): Actual Logs / Live Timer.

6. Step-by-Step Implementation Prompts for Claude Code
Execute these tasks sequentially with Claude Code.

Phase 1: Foundation & Data Layer
code
Bash
# Task 1.1: Project Setup
"Initialize a Next.js 14 project with Tailwind CSS, TypeScript, and App Router. Install shadcn/ui, prisma, lucide-react, date-fns, and rrule."

# Task 1.2: Prisma Schema & Seed
"Create the Prisma schema defined in the SPEC (User, Category, TimeEvent). Create a seed script in `prisma/seed.ts` that populates the 11 default categories (Work, Study, Health, Entertainment, Chill, Social, Sleep, Household, Commute, Side Projects, Other) with their designated colors."
Phase 2: Category Management & Live Timer
code
Bash
# Task 2.1: Categories CRUD Server Actions
"Create Server Actions for CRUD operations on Categories. Include default category fetch logic and user custom category creation."

# Task 2.2: Live Timer Zustand Store & Floating Widget
"Implement a Zustand store `useTimer` to manage live tracking state (start time, paused state, selected category, event title). Create a floating TimerWidget component at the bottom of the screen allowing users to start, pause, stop, and save an ACTUAL event."
Phase 3: Interactive Calendar Grid
code
Bash
# Task 3.1: Dual-Layer Grid Component
"Build a custom responsive Calendar component supporting Day, Week, Month, and Year views. Implement split-column rendering for time slots so PLANNED events (dashed border) and ACTUAL events (solid block) sit side-by-side on the same timeline."

# Task 3.2: Event Creation / Edit Modal
"Create a Modal form using shadcn/ui Dialog to create or edit an event. Allow selecting layer (PLANNED vs ACTUAL), category, start/end time, frequency (ONCE, DAILY, WEEKLY, MONTHLY, CUSTOM), and optional link to a planned event. Ensure rapid conversion: adding a 'Log Actual' button on Planned cards."
Phase 4: Analytics Engine & Dashboard
code
Bash
# Task 4.1: Analytics Processing Utility
"Implement `src/lib/analytics-utils.ts` to compute planned vs actual totals, category breakdown, variance, and adherence percentage over custom date ranges."

# Task 4.2: Analytics Dashboard Page
"Build the `/analytics` route with Recharts. Render: 1) Side-by-side Donut charts for Planned vs Actual time; 2) Bar charts showing category variance; 3) Summary KPI cards (Adherence Rate %, Over/Under variance hours); 4) Actionable insight alerts."
Phase 5: Polish & Optimizations
code
Bash
# Task 5.1: Drag-and-Drop Adjustment
"Integrate `@dnd-kit` into the Calendar view allowing users to drag planned or actual event blocks to change start times or drag handles to resize event durations."

# Task 5.2: Year Heatmap View
"Build a Year view rendered as a 365-day heatmap (GitHub contribution style) where cell color intensity reflects daily Plan Adherence Score."
7. Verification & Definition of Done (DoD)
Category Default Verification: Running npx prisma db seed successfully populates all 11 default categories.

Dual-Layer Visual Check: Creating a Planned event (e.g., Work 09:00-11:00) and an Actual event (Work 09:15-11:30) places them correctly side-by-side in Daily and Weekly views.

Timer Functionality: Pressing "Start" on the TimerWidget tracks real-time elapsed seconds and correctly commits a new ACTUAL TimeEvent to PostgreSQL upon hitting "Stop & Save".

Analytics Accuracy: Creating 2 hours of planned Work and 3 hours of actual Work correctly reflects a 
+
1.0
 hr
+1.0 hr
 (
+
50
%
+50%
) variance in the /analytics dashboard charts.
