/**
 * index.js - Backend Server
 *
 * Express.js server for the FSM Mobile Web Container app.
 * Receives the FSM Mobile POST context, stores it per-session,
 * and serves the UI5 frontend.
 *
 * Session fix: each user gets their own context slot keyed by
 * userName + cloudId. Avoids one user's POST overwriting another's.
 * Sessions are cleaned up after 1 hour to prevent unbounded growth.
 *
 * @file index.js
 * @requires express
 */

const express = require('express');
const path = require('path');
const FSMService = require('./utils/FSMService');

const app = express();

// ===========================
// SESSION CONTEXT STORAGE
// ===========================

/**
 * Map of sessionKey -> { ...fsmContext, _timestamp }
 * Key format: "<userName>-<cloudId>"
 * One entry per user+object combination, cleaned up after SESSION_TTL_MS.
 */
const sessions = {};
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Remove sessions older than SESSION_TTL_MS.
 * Runs every 10 minutes.
 */
setInterval(() => {
    const cutoff = Date.now() - SESSION_TTL_MS;
    let removed = 0;
    Object.keys(sessions).forEach(key => {
        if (sessions[key]._timestamp < cutoff) {
            delete sessions[key];
            removed++;
        }
    });
    if (removed > 0) {
        console.log(`Session cleanup: removed ${removed} expired session(s). Active: ${Object.keys(sessions).length}`);
    }
}, 10 * 60 * 1000);

// ===========================
// MIDDLEWARE
// ===========================
app.use((req, res, next) => {
    // Required: allows FSM Mobile WebView to embed this app
    res.removeHeader('X-Frame-Options');
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.enable('trust proxy');

// ===========================
// WEB CONTAINER ENTRY POINT
// ===========================

/**
 * Stores FSM Mobile context in the session map and redirects to the app root.
 * The session key is passed as a URL query param so the frontend can
 * retrieve exactly its own context, even if other users open simultaneously.
 *
 * @param {Object} body - FSM Mobile POST body
 * @param {Object} res  - Express response
 */
function handleMobilePost(body, res) {
    const userName = body?.userName || 'unknown';
    const cloudId  = body?.cloudId  || 'unknown';
    const key = `${userName}-${cloudId}`;

    sessions[key] = { ...body, _timestamp: Date.now() };

    console.log(`Web container opened | user: ${userName} | objectType: ${body?.objectType} | session: ${key}`);

    const host = res.req.protocol + '://' + res.req.get('host');
    res.redirect(`${host}/?session=${encodeURIComponent(key)}`);
}

/**
 * POST /web-container-access-point
 *
 * FSM Mobile sends a POST here when opening the web container.
 * Configure this URL in FSM Admin > Company > Web Containers.
 *
 * Context body contains:
 * { userName, authToken, cloudAccount, companyName, cloudId,
 *   objectType, language, dataCloudFullQualifiedDomainName }
 */
app.post('/web-container-access-point', (req, res) => {
    handleMobilePost(req.body || {}, res);
});

// Fallback: some FSM versions POST to root
app.post('/', (req, res) => {
    handleMobilePost(req.body || {}, res);
});

/**
 * GET /web-container-context?session=<key>
 *
 * Frontend calls this on load to retrieve its own stored context.
 * Returns 404 if no session key is provided or the key is not found
 * (e.g. app opened directly in a browser, or session expired).
 */
app.get('/web-container-context', (req, res) => {
    const key = req.query.session;

    if (!key) {
        return res.status(404).json({ message: 'No session key provided. Open from FSM Mobile.' });
    }

    const context = sessions[key];
    if (!context) {
        return res.status(404).json({ message: `Session '${key}' not found or expired.` });
    }

    // Return context without the internal timestamp field
    const { _timestamp, ...contextData } = context;
    return res.json(contextData);
});

// ===========================
// FSM API ENDPOINTS
// ===========================

/**
 * GET /api/udo-values?cloudId=<id>
 *
 * Queries FSM UdoValue API using the cloudId (upper-cased) and returns
 * the checklist instance and preliminary report template values.
 */
app.get('/api/udo-values', async (req, res) => {
    const cloudId = req.query.cloudId;

    if (!cloudId) {
        return res.status(400).json({ message: 'cloudId query parameter is required.' });
    }

    try {
        const result = await FSMService.getUdoValues(cloudId);
        return res.json(result);
    } catch (error) {
        console.error('UdoValue endpoint error:', error.message);
        return res.status(500).json({ message: 'Failed to fetch UdoValue data.' });
    }
});

/**
 * GET /api/build-report?objectId=<id>&reportTemplate=<id>&language=<lang>
 *
 * Builds a report via FSM Reporting API and returns the PDF binary.
 * - objectId: Checklist instance ID (z_Linker_Checklist_Instance)
 * - reportTemplate: Report template UUID (z_Linker_PreliminaryReportTemplate)
 * - language: Report language (default: 'de')
 */
app.get('/api/build-report', async (req, res) => {
    const { objectId, reportTemplate, language } = req.query;

    if (!objectId || !reportTemplate) {
        return res.status(400).json({ message: 'objectId and reportTemplate query parameters are required.' });
    }

    try {
        const pdfBuffer = await FSMService.buildReport(objectId, reportTemplate, language || 'de');

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length,
            'Content-Disposition': 'inline; filename="report.pdf"'
        });

        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Build report endpoint error:', error.message);
        return res.status(500).json({ message: error.message || 'Failed to build report.' });
    }
});

// ===========================
// STATIC FILES (UI5 frontend)
// ===========================
app.use(express.static(path.join(__dirname, 'webapp')));

// ===========================
// START SERVER
// ===========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`FSM Web Container app running on port ${PORT}`);
});