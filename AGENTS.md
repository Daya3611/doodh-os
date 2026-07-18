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
# AGENTS.md

# DoodhOS Development Guidelines

## Project

DoodhOS is a production-ready Milk Collection Center ERP built with:

- Next.js 16
- TypeScript
- Firebase Firestore
- PWA (Offline First)
- IndexedDB (Dexie)
- TailwindCSS
- ShadCN UI
- TanStack Query

This is a REAL commercial ERP.

Never generate demo code.

Never generate mock APIs.

Never generate placeholder components.

Every implementation must be production-ready.

---

# Architecture

UI

↓

Repository Layer

↓

IndexedDB (Offline Database)

↓

Sync Service

↓

Firebase Firestore

The UI must NEVER communicate directly with Firebase.

Every write operation must go through the Repository Layer.

---

# Offline First

The application must work completely offline.

Offline supported modules:

- Milk Collection
- Rate Chart
- Farmer Lookup
- Payments
- Inventory
- Purchases
- Sales
- Reports (Cached)

When offline

Save records into IndexedDB.

Mark records as Pending Sync.

When internet returns

User clicks

Sync Data

↓

Upload pending records

↓

Download latest cloud changes

↓

Update IndexedDB

↓

Mark synced.

Never lose user data.

---

# Data Rules

Never delete user data automatically.

Soft delete wherever possible.

Maintain createdAt

Maintain updatedAt

Maintain syncedAt

Maintain createdBy

Maintain updatedBy

All timestamps should use server timestamps when syncing.

---

# Coding Standards

Always use

TypeScript

Strict typing

Reusable hooks

Reusable services

Reusable repositories

Avoid duplicate logic.

No any type.

No inline business logic inside components.

---

# Firebase

Never call Firestore directly inside React Components.

Always use Repository classes.

Use batch writes whenever possible.

Use transactions where needed.

Never duplicate writes.

---

# IndexedDB

Use Dexie.js.

Never use localStorage for application data.

IndexedDB is the only offline database.

All pending sync records should be stored locally.

---

# PWA

Maintain

Service Worker

Offline Cache

Background Sync

Install Prompt

Cache

Images

Icons

Fonts

Static assets

Never cache Firestore responses directly.

---

# Inventory Rules

Inventory always stores stock in Base Unit.

Example

Cow Feed

Base Unit

KG

Variants

50 KG Bag

25 KG Bag

10 KG Bag

Loose KG

Purchasing

10 Bags

↓

500 KG

Selling

5 Bags

↓

250 KG

Stock should always remain accurate.

---

# Milk Collection

Features

Morning Shift

Evening Shift

Cow

Buffalo

Nearest FAT/SNF Matching

Duplicate Detection

Collection Editing

Automatic Rate Calculation

Offline Collection

Automatic Sync

---

# Rate Chart

Support

Effective Date

History

Password Protection

Nearest Matching

Future Rate Changes

Audit Log

---

# Payments

Support

Weekly Bills

10 Day Bills

Custom Bills

Manual Deductions

Milk Damage

Advance

Penalty

Other

---

# Reports

Support

Today

Yesterday

7 Days

30 Days

Financial Year

All Time

Custom Date Range

One global filter should update every report and dashboard.

---

# Dashboard

Cards

Charts

Revenue

Collection

Payments

Inventory

Animal Distribution

Recent Collections

Everything should use the global dashboard filter.

---

# UI

Use

TailwindCSS

ShadCN

Responsive Layout

Professional ERP Design

Keyboard Friendly

Loading States

Empty States

Skeleton Loaders

Proper Error Handling

---

# Error Handling

Never silently fail.

Show meaningful messages.

Retry failed operations.

Log synchronization failures.

---

# Security

Use Firebase Authentication.

Protect routes.

Validate permissions.

Never trust client input.

---

# Performance

Lazy load heavy modules.

Virtualize large tables.

Paginate reports.

Optimize Firestore queries.

Avoid unnecessary re-renders.

---

# Folder Structure

src/

components/

hooks/

repositories/

services/

lib/

store/

types/

utils/

app/

Never place business logic inside UI components.

---

# Before Every Feature

Ensure

✓ Offline Support

✓ Sync Support

✓ Responsive Design

✓ Type Safety

✓ Firestore Rules

✓ IndexedDB Support

✓ Loading State

✓ Error State

✓ Success State

✓ Production Ready

---

# Never Do

❌ Demo Code

❌ Mock APIs

❌ Fake Delays

❌ Placeholder Functions

❌ Duplicate Logic

❌ Direct Firebase Calls in Components

❌ localStorage for ERP Data

❌ Breaking Existing Features

---

# Always Do

✔ Production Code

✔ Clean Architecture

✔ Reusable Components

✔ Strong Typing

✔ Offline First

✔ IndexedDB

✔ Firebase Sync

✔ Responsive UI

✔ Performance Optimized

✔ Enterprise-Level Code Quality
```
