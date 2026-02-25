# Preliminary Report Preview - FSM Mobile Integration App

A SAP Fiori mobile application for SAP Field Service Management (FSM), designed to run in FSM Mobile (Web Container). Automatically generates and displays a checklist report (PDF) based on the opened checklist instance.

> **Version:** 0.0.1  
> **Platform:** SAP BTP Cloud Foundry  
> **Last Updated:** February 2026

---

## 📋 Table of Contents

- [Screenshots](#-screenshots)
- [Overview](#-overview)
- [Architecture](#-architecture)
- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Setup & Deployment](#-setup--deployment)
- [FSM Mobile Integration](#-fsm-mobile-integration)
- [Expected Result](#-expected-result)
- [How It Works](#-how-it-works)
- [API Reference](#-api-reference)
- [Troubleshooting](#-troubleshooting)
- [Application Details](#-application-details)
- [Current Status](#-current-status)
- [Security Notes](#-security-notes)

---

## 📸 Screenshots

### 1. PDF Report Preview

<!-- TODO: Add screenshot of the app showing the rendered preliminary report PDF -->
![PDF Preview](docs/screenshots/01-pdf-preview.png)

| Element | Description | Key Files |
|---------|-------------|-----------|
| **PDF Viewer** | Embedded PDF rendering of the preliminary checklist report | `View1.view.xml` → `PDFViewer` |
| **Download Button** | Native UI5 download button for saving the PDF | `View1.view.xml` → `showDownloadButton="true"` |

---

### Screenshot Checklist

| # | Screenshot | Status |
|---|------------|--------|
| 1 | PDF Report Preview | ⬜ TODO |

**Screenshot folder:** `docs/screenshots/`

---

## 🎯 Overview

This application provides a seamless preliminary report preview experience within FSM Mobile. When a technician opens a checklist instance, the app automatically resolves the associated report template, builds the report via the FSM Reporting API, and displays the resulting PDF inline.

**Key Features:**
- ✅ Automatic PDF report generation from checklist instance context
- ✅ UdoValue-based configuration lookup (Linker_Object)
- ✅ Report template name-to-UUID resolution
- ✅ Embedded PDF display with download option
- ✅ Fallback logic for Checklist Instance fields (Instance1 → Instance2)
- ✅ Secure authentication via SAP BTP Destination Service
- ✅ Single-point destination configuration

**Technology Stack:**
- **Frontend:** SAP UI5 (Fiori) with `sap.m.PDFViewer`
- **Backend:** Node.js + Express
- **Deployment:** SAP Business Technology Platform (Cloud Foundry)
- **Authentication:** OAuth 2.0 via BTP Destination Service

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         ENTRY POINT                                      │
├──────────────────────────────────────────────────────────────────────────┤
│   FSM Mobile (Web Container)                                             │
│   Technician opens checklist instance → Web Container opens app          │
│        │                                                                 │
│  POST context (cloudId, userName, objectType, ...)                       │
└────────┼─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      SAP BTP (Cloud Foundry)                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      UI5 App (Frontend)                           │  │
│  │                                                                   │  │
│  │  1. Load context (cloudId from FSM Mobile POST)                   │  │
│  │  2. Fetch UdoValues (checklist instance + report template name)   │  │
│  │  3. Build report (PDF via Reporting API)                          │  │
│  │  4. Display PDF inline (sap.m.PDFViewer)                          │  │
│  └───────────────────────────┬───────────────────────────────────────┘  │
│                              │                                          │
│  ┌───────────────────────────▼───────────────────────────────────────┐  │
│  │                   Express Server (Backend)                        │  │
│  │                                                                   │  │
│  │  - Web Container Context Storage (session map)                    │  │
│  │  - /api/udo-values (UdoValue + ReportTemplate resolution)         │  │
│  │  - /api/build-report (FSM Reporting API proxy)                    │  │
│  └───────────────────────────┬───────────────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │ OAuth Token
                               ▼
                      ┌─────────────────┐
                      │ BTP Destination │  (FSM_OAUTH_CONNECT)
                      │    Service      │
                      └────────┬────────┘
                               │ Authenticated Request
                               ▼
                      ┌─────────────────┐
                      │     FSM API     │  (SAP Field Service Management)
                      │                 │
                      │  - Query API v1 (UdoValue, ReportTemplate)
                      │  - Reporting API v1 (PDF build)
                      └─────────────────┘
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Auto Report Generation** | Automatically builds and displays the preliminary report when the app is opened |
| **UdoValue Lookup** | Queries `Linker_Object` UdoValues using the cloudId to find checklist instance and report template |
| **Instance Fallback** | Tries `z_Linker_Checklist_Instance1` first, falls back to `z_Linker_Checklist_Instance2` |
| **Template Resolution** | Resolves report template name to UUID via `ReportTemplate` query |
| **PDF Viewer** | Native `sap.m.PDFViewer` with `isTrustedSource` enabled for inline rendering |
| **Download** | Built-in download button for saving the PDF locally |
| **Session Isolation** | Per-user session keys prevent context conflicts between simultaneous users |
| **Token Caching** | OAuth tokens cached with 5-minute expiry buffer to minimize authentication requests |

---

## ✅ Prerequisites

### Required Tools:
| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | v18.0.0+ | Backend runtime |
| **npm** | v8.0.0+ | Package management |
| **Cloud Foundry CLI** | Latest | `cf` command for deployment |
| **UI5 CLI** | v4.0.33+ | Build tooling (dev dependency) |

### SAP BTP Account:
- Cloud Foundry space with available quota
- Memory: 256MB (configurable in `manifest.yaml`)
- Disk: 512MB

### SAP BTP Services:

| Service | Instance Name | Purpose |
|---------|---------------|---------|
| **Destination Service** | `mobileappprevrep-destination` | FSM API connectivity |

### Destination Configuration (FSM_OAUTH_CONNECT):

The destination `FSM_OAUTH_CONNECT` must be configured in BTP Cockpit with:

| Property | Description |
|----------|-------------|
| **URL** | FSM API base URL (e.g., `https://de.fsm.cloud.sap`) |
| **Authentication** | OAuth2ClientCredentials |
| **Token Service URL** | FSM OAuth token endpoint |
| **Client ID** | FSM OAuth client ID |
| **Client Secret** | FSM OAuth client secret |

**Additional Properties:**

| Property | Description |
|----------|-------------|
| `account` | FSM account name |
| `company` | FSM company name |
| `URL.headers.X-Account-ID` | FSM Account ID |
| `URL.headers.X-Company-ID` | FSM Company ID |
| `URL.headers.X-Client-ID` | Client identifier (e.g., `FSM_Extension`) |
| `URL.headers.X-Client-Version` | Client version (e.g., `0.0.1`) |

### FSM Configuration:

| Requirement | Description |
|-------------|-------------|
| **UdoMeta** | `Linker_Object` UDO must exist with `z_Linker_Checklist_Instance1`, `z_Linker_Checklist_Instance2`, `z_Linker_PreliminaryReportTemplate` fields |
| **ReportTemplate** | Preliminary report template must be configured as **online** (not offline) |
| **Company Setting** | `CoreSystems.Checklist.GenerateOfflineChecklistReport` must be set to `false` for cloud-based report generation |
| **Custom Fields** | All UDFs referenced in the report template must exist (e.g., `Z_ChecklistExpert`) |

---

## 🚀 Setup & Deployment

### 1. Clone & Install
```bash
git clone <repository-url>
cd mobileappprevrep
npm install
```

### 2. Configure Destination Name (Optional)

The destination name is configured in a single place. Edit `utils/FSMService.js`:
```javascript
this.config = {
    destinationName: 'FSM_OAUTH_CONNECT'  // Change here to switch destination
};
```

### 3. Configure BTP Destination

Create a destination named **FSM_OAUTH_CONNECT** in SAP BTP Cockpit:
```
Name: FSM_OAUTH_CONNECT
Type: HTTP
URL: https://de.fsm.cloud.sap
Authentication: OAuth2ClientCredentials
Token Service URL: https://de.fsm.cloud.sap/api/oauth2/v1/token
Client ID: <your-fsm-client-id>
Client Secret: <your-fsm-client-secret>

Additional Properties:
  account: <your-account>
  company: <your-company>
  URL.headers.X-Account-ID: <your-account-id>
  URL.headers.X-Company-ID: <your-company-id>
  URL.headers.X-Client-ID: FSM_Extension
  URL.headers.X-Client-Version: 0.0.1
```

### 4. Create Destination Service Instance
```bash
cf create-service destination lite mobileappprevrep-destination
```

### 5. Deploy to Cloud Foundry
```bash
cf push
```

### 6. Get Application URL
```bash
cf app mobileappprevrep
```

Copy the URL (e.g., `https://mobileappprevrep-xxx.cfapps.eu10.hana.ondemand.com`)

---

## 📱 FSM Mobile Integration

### Configure FSM Web Container

Navigate to: **FSM Admin → Company → Web Containers**

#### 1. Create Web Container
| Field | Value |
|-------|-------|
| **Name** | `TUVNMobileAppPreviewPDF` |
| **URL** | `https://mobileappprevrep-xxx.cfapps.eu10.hana.ondemand.com/web-container-access-point` |
| **Object Types** | `ChecklistInstance` |
| **Active** | ✓ Checked |

#### 2. Web Container Context
When opened from FSM Mobile, the web container automatically POSTs context data:

| Field | Description |
|-------|-------------|
| `cloudId` | Checklist Instance ID (used as lookup key for UdoValue query, converted to UPPERCASE) |
| `objectType` | Object type (`ChecklistInstance`) |
| `userName` | Current user's name |
| `cloudAccount` | FSM account name |
| `companyName` | FSM company name |
| `language` | User's language preference |
| `dataCloudFullQualifiedDomainName` | FSM cloud domain |

---

## ✅ Expected Result

### On FSM Mobile:
1. Technician opens a **Checklist Instance**
2. Taps the **"Preview PDF"** web container button
3. App opens and automatically:
   - Receives context with `cloudId` (checklist instance UUID)
   - Queries UdoValue to find the linked checklist instance and report template name
   - Resolves report template name → UUID
   - Calls FSM Reporting API to build the PDF
4. **Preliminary report PDF** displayed inline within the app
5. Technician can scroll through the report and use the **Download** button to save it

### Error States:
| Scenario | Displayed |
|----------|-----------|
| App opened outside FSM Mobile | "Open from FSM Mobile" illustrated message |
| UdoValue lookup fails | "Could not build the report" error strip |
| Report build fails | "Could not build the report" error strip |

---

## 🔄 How It Works

### Data Flow:
```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. FSM Mobile POSTs context with cloudId                               │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. Backend stores context, redirects to UI with session key            │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. Frontend fetches context, extracts cloudId                          │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4. GET /api/udo-values?cloudId=<id>                                    │
│     a. cloudId → UPPERCASE                                              │
│     b. Query: UdoValue JOIN UdoMeta WHERE Instance1 = cloudId           │
│     c. Fallback: Query with Instance2 if no results                     │
│     d. Extract z_Linker_PreliminaryReportTemplate name                  │
│     e. Resolve template name → UUID via ReportTemplate query            │
│     f. Return { checklistInstance, preliminaryReportTemplate }          │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  5. GET /api/build-report?objectId=<instance>&reportTemplate=<uuid>     │
│     a. POST to FSM /api/reporting/v1/build                              │
│     b. Payload: { reportLanguage, reportParameters, reportTemplate,     │
│                    reportType: "PDF" }                                   │
│     c. Return PDF binary                                                │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  6. sap.m.PDFViewer renders PDF inline (isTrustedSource=true)           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Authentication Flow:
```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. Read VCAP_SERVICES → Get Destination Service credentials            │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. Call BTP Destination Service → Get OAuth token                      │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. Fetch FSM_OAUTH_CONNECT destination → Get FSM URL + OAuth config    │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4. Get FSM OAuth token → Authenticate with FSM API                     │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  5. Token cached (TokenCache.js) → Reused until 5 min before expiry     │
└──────────────────────────┬──────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  6. Make FSM API calls → UdoValue query, ReportTemplate, Report build   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure
```
mobileappprevrep/
│
├── # ─────────── ROOT LEVEL ───────────
├── index.js                             # Express server: context storage, API endpoints
├── package.json                         # Node.js dependencies
├── manifest.yaml                        # Cloud Foundry deployment
├── mta.yaml                             # Multi-Target Application descriptor
├── xs-app.json                          # App Router configuration
├── xs-security.json                     # Security configuration
├── ui5.yaml                             # UI5 tooling configuration
├── ui5-local.yaml                       # UI5 local development config
├── ui5-deploy.yaml                      # UI5 deployment config
├── .gitignore                           # Git ignore rules
├── README.md                            # This file
│
├── # ─────────── BACKEND SERVICES ───────────
├── utils/
│   ├── DestinationService.js            # BTP Destination handling
│   ├── FSMService.js                    # FSM API: UdoValue query + Report building
│   └── TokenCache.js                    # OAuth token caching
│
└── # ─────────── FRONTEND (SAP UI5) ───────────
webapp/
│
├── index.html                       # App entry point (UI5 bootstrap)
├── manifest.json                    # UI5 app descriptor
├── Component.js                     # UI5 Component
├── _appGenInfo.json                 # Generator info
│
├── view/
│   ├── App.view.xml                 # Root view (App container)
│   └── View1.view.xml               # Main view (PDF Viewer + error states)
│
├── controller/
│   ├── App.controller.js            # Root controller
│   └── View1.controller.js          # Main controller (context → UdoValues → report)
│
├── model/
│   └── models.js                    # Device model
│
├── css/
│   └── style.css                    # Custom styles
│
├── i18n/
│   └── i18n.properties              # Internationalization
│
└── test/                            # Test files
```

---

## 🔌 API Reference

### Backend Endpoints

#### Web Container
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/web-container-access-point` | Receive context from FSM Mobile web container |
| POST | `/` | Alternative web container entry point (FSM fallback) |
| GET | `/web-container-context?session=<key>` | Retrieve stored web container context |

#### UdoValue & Report
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/udo-values?cloudId=<id>` | Query UdoValues: returns checklist instance + report template UUID |
| GET | `/api/build-report?objectId=<id>&reportTemplate=<id>&language=<lang>` | Build report PDF via FSM Reporting API |

### FSM APIs Used

| API | Endpoint | Purpose |
|-----|----------|---------|
| **Query API v1** | `/api/query/v1` | UdoValue lookup (Linker_Object, checklist instance resolution) |
| **Query API v1** | `/api/query/v1` | ReportTemplate name → UUID resolution |
| **Reporting API v1** | `/api/reporting/v1/build` | PDF report generation |

### Key Files

#### Backend (Node.js/Express)

| File | Purpose |
|------|---------|
| `index.js` | Express server: web container context, `/api/udo-values`, `/api/build-report` endpoints |
| `utils/FSMService.js` | FSM API integration: `_getConnection()`, `getUdoValues()`, `buildReport()` |
| `utils/DestinationService.js` | BTP Destination Service: reads VCAP_SERVICES, fetches destination config |
| `utils/TokenCache.js` | OAuth token caching (5-minute expiry buffer) |

#### Frontend (SAP UI5)

| File | Purpose |
|------|---------|
| `webapp/view/View1.view.xml` | Main view: `PDFViewer` with error/loading states |
| `webapp/controller/View1.controller.js` | Main controller: `_loadContext()` → `_loadUdoValues()` → `_buildReport()` |
| `webapp/Component.js` | UI5 Component with routing |
| `webapp/manifest.json` | UI5 app descriptor, routing config, dependencies |

---

## 🐛 Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Open from FSM Mobile" message | App opened directly in browser | Open from FSM Mobile via configured Web Container |
| "Could not build the report" | UdoValue lookup or report build failed | Check server logs via `cf logs mobileappprevrep --recent` |
| PDF shows "The PDF cannot be displayed" | `isTrustedSource` not set | Ensure `isTrustedSource="true"` on `PDFViewer` (UI5 1.120.7+ breaking change) |
| CA-207: Offline report error | Report template configured as offline | Set `CoreSystems.Checklist.GenerateOfflineChecklistReport` to `false` in FSM Company Settings |
| CA-31: Resource not found | Report template missing subreport/resource files | Upload all referenced resources alongside the template in FSM |
| CA-152: No Udf into UdfMeta | Report template references missing custom field | Create the missing UDF on the ChecklistInstance object type in FSM Admin |
| No UdoValue results | cloudId not matching any Linker_Object entries | Verify the checklist instance has a linked Linker_Object UdoValue with matching Instance1/Instance2 |
| 401/403 on API calls | OAuth token expired or invalid credentials | Check destination configuration in BTP Cockpit |
| Destination service not bound | VCAP_SERVICES missing destination | Run `cf bind-service mobileappprevrep mobileappprevrep-destination` and restage |
| Report takes long to load | Complex report template | FSM has a 5-minute / 1000-page limit for report generation |

### Server Logs

View server-side logs via Cloud Foundry:
```bash
cf logs mobileappprevrep --recent
```

**Key log patterns:**
- `Web container opened | user: X | objectType: Y` — Context received from FSM Mobile
- `FSMService: Instance1 query returned no results, trying Instance2` — Fallback triggered
- `FSMService: Resolved template 'X' -> Y` — Template name → UUID resolved
- `FSMService: Building report with payload:` — Report API call details
- `FSMService: Report built successfully, size: X bytes` — PDF generated
- `FSMService: UdoValue query error:` — Query API failure
- `FSMService: Report build error:` — Reporting API failure

---

## 📝 Application Details

|                                    |                                                          |
|------------------------------------|----------------------------------------------------------|
| **App Name**                       | Preliminary Report Preview                               |
| **Module Name**                    | mobileappprevrep                                         |
| **Framework**                      | SAP UI5 (Fiori) + Node.js Express                        |
| **UI5 Theme**                      | sap_horizon                                              |
| **UI5 Version**                    | 1.144.1 (loaded from CDN)                                |
| **Deployment Platform**            | SAP Business Technology Platform (Cloud Foundry)         |
| **Node.js Version**                | 18+                                                      |
| **Supported Contexts**             | FSM Mobile (Web Container)                               |
| **BTP Region**                     | EU10                                                     |

---

## 🚀 Current Status

### ✅ Implemented:

**Context & Integration:**
- FSM Mobile Web Container integration (receives context via POST)
- Per-user session isolation (userName + cloudId keyed)
- Session cleanup (1-hour TTL, 10-minute sweep)

**UdoValue Resolution:**
- Query UdoValue with JOIN on UdoMeta (Linker_Object)
- Checklist Instance1 → Instance2 fallback logic
- Report template name → UUID resolution via ReportTemplate query
- cloudId automatic UPPERCASE conversion

**Report Generation:**
- FSM Reporting API integration (`/api/reporting/v1/build`)
- PDF binary streaming from backend to frontend
- Inline PDF rendering via `sap.m.PDFViewer` with `isTrustedSource`
- Download button for saving PDF locally

**Infrastructure:**
- Single-point destination configuration (`FSM_OAUTH_CONNECT`)
- No hardcoded account/company fallbacks (reads from destination only)
- OAuth token caching with 5-minute expiry buffer
- Centralized `_getConnection()` helper (DRY pattern)

### 📋 Planned:
- German translations (i18n)
- Print functionality
- Report type selection (PDF/DOCX/XLS)
- Error detail display in UI

---

## 🔐 Security Notes

- OAuth tokens cached in memory (not persisted to disk)
- Destination credentials stored securely in VCAP_SERVICES
- Web container context stored in memory (cleared on restart, 1-hour TTL)
- HTTPS enforced by Cloud Foundry
- No sensitive data logged (auth tokens excluded from logs)
- `X-Frame-Options` removed to allow FSM Mobile WebView embedding
- `isTrustedSource` enabled only for own backend PDF endpoint

---

## 📄 License

Internal use only - Company proprietary.

---

**Last Updated:** February 2026