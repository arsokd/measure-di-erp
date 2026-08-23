# K-30_ERP

**Enterprise Revenue Operations & ERP Platform**  
*Measure DI Technologies Private Limited*

---

## Overview

**K-30_ERP** is an industrial-grade enterprise ERP and Revenue Operations platform built for equipment manufacturers, turnkey project providers, and industrial automation service teams.

### Core Architecture & Domains

1. **Overview**: Executive Dashboard, Macro Financials & KPI Conversion Funnels.
2. **Sales & Revenue (Capital Equipment)**: Lead pipeline, Quotation builder with tiered discount approvals (>15% Head, >25% MD), PO Orders, Milestone Invoicing, and Payment realization.
3. **Service & Quality Hub (Recurring ARR)**: Service & Breakdown Tickets with 60-day repeat failure detection, AMC Contracts Registry, AMC Quotations, AMC Orders, AMC Invoicing, High-Margin Spare Parts Sales, and Warranty/RMA claims.
4. **Finance & Ledger**: Multi-project expense cost splitting, dynamic profit centers, and payroll CTC calculations.
5. **People & HR**: Employee directory, Attendance & Leaves with geotagging, and My Team oversight.
6. **Performance & Governance**: Daily Work Management (DWM), KRA scoring, Annual Operating Plan (AOP), Standard Operating Procedures (SOP), and universal Super Admin Audit Trails.

---

## Deployment & Hosting

### Netlify Deployment

- **Site Name**: `k-30-erp` (or `k-30_erp`)
- **Live URL**: `https://k-30-erp.netlify.app`
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
- **Node Version**: `20.x`

Refer to [`NETLIFY_DEPLOYMENT_GUIDE.md`](./NETLIFY_DEPLOYMENT_GUIDE.md) for full step-by-step setup and GitHub CI/CD integration.

---

## Local Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Production build
npm run build
```
