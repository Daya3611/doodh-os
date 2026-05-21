````md
# AGENT.md

# Milk Collection Center SaaS — AI Agent Development Guide

This document defines the complete architecture, development standards, coding rules, business logic, UI behavior, and system workflows for the Milk Collection Center SaaS platform.

The AI agent must strictly follow this specification while generating code, architecture, components, database models, APIs, UI, and workflows.

---

# PROJECT OVERVIEW

Build a production-grade multi-tenant Milk Collection Center SaaS application for dairy collection centers.

The platform will be used daily by:
- Milk collection operators
- Milk center owners
- SaaS platform admin

The software manages:
- Farmer records
- Milk collection
- FAT/SNF-based rate calculation
- Payments
- Reports
- Staff management
- Subscription management

The software must be:
- Fast
- Offline-capable
- Mobile/tablet friendly
- Easy for rural operators
- Production scalable

---

# TECH STACK

## Frontend
- Next.js 15+
- TypeScript
- Tailwind CSS
- Shadcn UI
- React Hook Form
- Zod
- Zustand
- TanStack Table
- Recharts

## Backend
- Firebase Authentication
- Firestore
- Firebase Storage
- Firebase Functions
- Firebase Hosting

## Runtime
- Bun

---

# PACKAGE MANAGER

Always use Bun.

## Commands

```bash
bun install
bun run dev
bun run build
````

Never use:

* npm
* yarn
* pnpm

---

# APPLICATION TYPE

This is a multi-tenant SaaS platform.

One application supports multiple milk centers.

Each center’s data must remain isolated.

---

# MULTI-TENANT STRUCTURE

## Firestore Structure

```txt
centers/
   centerId/
      farmers/
      collections/
      payments/
      staff/
      settings/
      reports/
      rateCharts/
```

---

# USER ROLES

Implement strict RBAC.

---

# ROLE: MASTER_ADMIN

Platform owner.

## Permissions

* Full system access
* Manage subscriptions
* Create centers
* Manage plans
* View analytics
* Access all data
* Activate/deactivate centers
* Billing management

---

# ROLE: OWNER

Milk center owner.

## Permissions

* Manage farmers
* Manage staff
* Configure rate charts
* Manage collections
* Manage payments
* Generate reports
* Configure settings

---

# ROLE: STAFF

Milk collection operator.

## Permissions

* Add collections
* View farmers
* Print receipts
* Use collection screen

## Restrictions

* Cannot edit rates
* Cannot manage staff
* Cannot access financial reports
* Cannot delete records

---

# UI/UX RULES

The application must prioritize:

* Speed
* Simplicity
* Large touch targets
* Minimal clicks
* Offline operation

---

# DESIGN RULES

## Required

* Clean modern UI
* Tablet-friendly
* Responsive layout
* Sidebar navigation
* Loading skeletons
* Toast notifications
* Empty states
* Dark mode support

## Use

* Shadcn UI components
* Tailwind utility classes
* Consistent spacing
* Large readable fonts

---

# COLLECTION SCREEN RULES

This is the most important screen.

Optimize for extremely fast entry.

## Requirements

* Keyboard-first navigation
* Instant calculations
* Auto-focus next input
* Numeric keypad support
* Minimal page reloads
* Optimistic UI updates

---

# FARMER MANAGEMENT

## Farmer Model

```ts
type Farmer = {
  id: string
  name: string
  mobile: string
  village: string
  animalType: "cow" | "buffalo"
  bankName?: string
  accountNumber?: string
  ifscCode?: string
  aadhaarNumber?: string
  active: boolean
  createdAt: Timestamp
}
```

---

# COLLECTION MODEL

```ts
type Collection = {
  id: string
  farmerId: string
  farmerName: string
  animalType: "cow" | "buffalo"
  shift: "morning" | "evening"
  liters: number
  fat: number
  snf: number
  clr?: number
  rate: number
  totalAmount: number
  createdBy: string
  createdAt: Timestamp
}
```

---

# PAYMENT MODEL

```ts
type Payment = {
  id: string
  farmerId: string
  amount: number
  paymentMethod: "cash" | "upi" | "bank"
  notes?: string
  paymentDate: Timestamp
}
```

---

# RATE CHART ENGINE

Milk rate depends on:

* Animal type
* FAT
* SNF

---

# RATE CALCULATION LOGIC

```txt
1. Detect animal type
2. Match FAT value
3. Match SNF value
4. Fetch rate
5. Calculate total

totalAmount = liters × rate
```

---

# RATE CHART MODEL

```ts
type RateChart = {
  id: string
  animalType: "cow" | "buffalo"
  fat: number
  snf: number
  rate: number
  effectiveFrom: Timestamp
}
```

---

# AUTHENTICATION RULES

Use Firebase Authentication.

## Features

* Email/password login
* Session persistence
* Protected routes
* Middleware auth guards
* Role-based redirects

---

# FIREBASE SECURITY RULES

Must enforce:

* Center isolation
* Role restrictions
* Read/write permissions

## Rules

* Staff only accesses own center
* Owners only access own center
* Master admin accesses all centers

---

# OFFLINE SUPPORT

Critical requirement.

## Must Support

* Firestore offline persistence
* Local caching
* Sync when online
* Offline indicator
* Conflict handling

---

# REPORTING SYSTEM

## Reports

* Daily collection
* Monthly collection
* Farmer summaries
* Payment summaries
* FAT analytics
* Shift reports

## Export

* PDF
* Excel
* CSV

---

# RECEIPT PRINTING

Support:

* Thermal printer
* A4 print layout

## Receipt Content

* Center name
* Farmer name
* Liters
* FAT
* SNF
* Rate
* Total amount
* Date/time

---

# DASHBOARD REQUIREMENTS

## Master Dashboard

* Total centers
* Active subscriptions
* Revenue
* Total collections

## Owner Dashboard

* Daily collection
* Pending payments
* FAT averages
* Collection trends

---

# PERFORMANCE RULES

Optimize for:

* Low-end Android devices
* Slow internet
* Rural environments

## Must Use

* Lazy loading
* Dynamic imports
* Indexed Firestore queries
* Optimistic UI
* Server components where possible

---

# NEXT.JS RULES

Use:

* App Router
* TypeScript
* Server Components
* Server Actions
* Route handlers
* Middleware protection

Avoid:

* Legacy Pages Router
* Unnecessary client components

---

# FOLDER STRUCTURE

```txt
src/
 ├── app/
 ├── components/
 ├── features/
 ├── firebase/
 ├── hooks/
 ├── lib/
 ├── services/
 ├── store/
 ├── styles/
 ├── types/
 ├── utils/
 └── config/
```

---

# CODING RULES

## Always

* Use TypeScript
* Use reusable components
* Use strict typing
* Use async/await
* Use modular architecture
* Use feature-based organization

## Never

* Use any type
* Hardcode secrets
* Duplicate logic
* Create giant components

---

# FORM RULES

Use:

* React Hook Form
* Zod validation

All forms must include:

* Validation
* Error messages
* Loading states
* Disabled submit during processing

---

# TABLE RULES

Use TanStack Table.

Features:

* Search
* Sorting
* Pagination
* Export
* Mobile responsiveness

---

# STATE MANAGEMENT

Use Zustand for:

* Auth state
* UI state
* Collection workflow state

---

# CHARTS

Use Recharts.

Required charts:

* Daily trends
* Monthly trends
* Animal comparison
* Revenue analytics

---

# MULTI-LANGUAGE SUPPORT

Support:

* English
* Hindi
* Marathi

Use:

* next-intl

---

# ACCESSIBILITY RULES

Must support:

* Keyboard navigation
* Proper labels
* Focus states
* High readability

---

# ERROR HANDLING

Implement:

* Global error boundaries
* Firebase error handling
* Form validation errors
* Toast notifications

---

# SECURITY RULES

Never expose:

* Firebase admin secrets
* API keys
* Internal configs

Use:

* Environment variables
* Secure Firestore rules
* Role checks everywhere

---

# FUTURE FEATURES

Potential future integrations:

* FAT machine integration
* Weight machine integration
* WhatsApp notifications
* SMS alerts
* AI analytics
* Mobile app
* PWA support

---

# DEVELOPMENT PRIORITY

## PHASE 1

* Authentication
* Farmers
* Collection module
* Rate chart
* Dashboard

## PHASE 2

* Payments
* Reports
* Printing
* Staff management

## PHASE 3

* SaaS billing
* Analytics
* AI features
* Mobile app

---

# FINAL GOAL

The final product must feel like a professional commercial dairy management software actively used in real milk collection centers.

The experience should prioritize:

* Speed
* Reliability
* Simplicity
* Offline support
* Ease of use
* Scalability

The software must be production-ready, maintainable, scalable, and optimized for real-world usage.

```
```
