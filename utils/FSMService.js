/**
 * FSMService.js
 *
 * Backend service for SAP FSM (Field Service Management) API integration.
 * Provides methods for all FSM data operations including activities, T&M entries,
 * lookup data, and user/organization management.
 *
 * Key Features:
 * - Authenticated requests to FSM Data API (/api/data/v4)
 * - Query API requests (/api/query/v1)
 * - Composite-tree API for service calls (/api/service-management/v2)
 * - User and Organization API integration
 * - T&M entry retrieval (TimeEffort, Material, Expense, Mileage)
 * - Lookup data (TimeTasks, Items, ExpenseTypes, Persons)
 *
 * API Endpoints Used:
 * - /api/data/v4/* - CRUD operations
 * - /api/query/v1 - Query operations
 * - /api/service-management/v2/composite-tree - Service call with activities
 * - /api/user/v1/users - User lookup
 * - /cloud-org-level-service/api/v1/levels - Organization hierarchy
 *
 * @file FSMService.js
 * @module utils/FSMService
 * @requires axios
 * @requires ./DestinationService
 * @requires ./TokenCache
 */
const axios = require('axios');
const DestinationService = require('./DestinationService');
const TokenCache = require('./TokenCache');

class FSMService {
    constructor() {
        /**
         * Default FSM account/company configuration.
         * @type {{account: string, company: string}}
         */
        this.config = {
            account: 'tuev-nord_t1',
            company: 'TUEV-NORD_S4E'
        };
    }

    /**
     * Make authenticated request to FSM Data API (/api/data/v4 endpoints).
     * @param {string} path - API path (e.g., '/Activity/123')
     * @param {Object} [params={}] - Query parameters
     * @returns {Promise<Object>} API response data
     * @throws {Error} If request fails
     */
    async makeRequest(path, params = {}) {
        try {
            const destination = await DestinationService.getDestination('FSM_OAUTH_CONNECT');
            const token = await TokenCache.getToken(destination);

            const baseUrl = destination.destinationConfiguration.URL;
            const fullUrl = `${baseUrl}/api/data/v4${path}`;

            const queryParams = {
                ...params,
                account: destination.destinationConfiguration.account || this.config.account,
                company: destination.destinationConfiguration.company || this.config.company
            };

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID'],
                'X-Client-ID': destination.destinationConfiguration['URL.headers.X-Client-ID'],
                'X-Client-Version': destination.destinationConfiguration['URL.headers.X-Client-Version']
            };

            const response = await axios.get(fullUrl, {
                params: queryParams,
                headers: headers
            });

            return response.data;

        } catch (error) {
            console.error('FSMService: API Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Make POST request to FSM API.
     * @param {string} path - API path (e.g., '/Expense')
     * @param {Object} data - Request body
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} API response
     */
    async postRequest(path, data, params = {}) {
        try {
            const destination = await DestinationService.getDestination('FSM_OAUTH_CONNECT');
            const token = await TokenCache.getToken(destination);

            const baseUrl = destination.destinationConfiguration.URL;
            const fullUrl = `${baseUrl}/api/data/v4${path}`;

            const queryParams = {
                ...params,
                account: destination.destinationConfiguration.account || this.config.account,
                company: destination.destinationConfiguration.company || this.config.company
            };

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID'],
                'X-Client-ID': destination.destinationConfiguration['URL.headers.X-Client-ID'],
                'X-Client-Version': destination.destinationConfiguration['URL.headers.X-Client-Version']
            };

            const response = await axios.post(fullUrl, data, {
                params: queryParams,
                headers: headers
            });

            return response.data;

        } catch (error) {
            console.error('FSMService: POST Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Make PATCH request to FSM API.
     * @param {string} path - API path (e.g., '/Expense/ID')
     * @param {Object} data - Request body
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Response data
     */
    async patchRequest(path, data, params = {}) {
        try {
            const destination = await DestinationService.getDestination('FSM_OAUTH_CONNECT');
            const token = await TokenCache.getToken(destination);

            const baseUrl = destination.destinationConfiguration.URL;
            const fullUrl = `${baseUrl}/api/data/v4${path}`;

            const queryParams = {
                ...params,
                forceUpdate: true,
                account: destination.destinationConfiguration.account || this.config.account,
                company: destination.destinationConfiguration.company || this.config.company
            };

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID'],
                'X-Client-ID': destination.destinationConfiguration['URL.headers.X-Client-ID'],
                'X-Client-Version': destination.destinationConfiguration['URL.headers.X-Client-Version']
            };

            const response = await axios.patch(fullUrl, data, {
                params: queryParams,
                headers: headers
            });

            return response.data;

        } catch (error) {
            console.error('FSMService: PATCH Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Make batch request to FSM Batch API.
     * Combines multiple API calls into a single HTTP request.
     * @param {Array} requests - Array of request objects
     * @param {boolean} transactional - If true, all requests succeed or all rollback
     * @returns {Promise<Array>} Array of response objects matching request order
     */
    async makeBatchRequest(requests, transactional = true) {
        try {
            if (!requests || requests.length === 0) return [];

            const destination = await DestinationService.getDestination('FSM_OAUTH_CONNECT');
            const token = await TokenCache.getToken(destination);

            const baseUrl = destination.destinationConfiguration.URL;
            const account = destination.destinationConfiguration.account || this.config.account;
            const company = destination.destinationConfiguration.company || this.config.company;

            const boundary = `======batch_${Date.now()}======`;

            let batchBody = '';
            requests.forEach((req, index) => {
                const contentId = `req${index + 1}`;
                const queryParams = new URLSearchParams({ ...req.params, account, company }).toString();
                const requestPath = `/api/data/v4${req.path}?${queryParams}`;

                batchBody += `--${boundary}\r\n`;
                batchBody += `Content-Type: application/http\r\n`;
                batchBody += `Content-ID: ${contentId}\r\n`;
                batchBody += `\r\n`;
                batchBody += `${req.method} ${requestPath} HTTP/1.1\r\n`;
                batchBody += `Content-Type: application/json\r\n`;
                batchBody += `\r\n`;
                if (req.data) batchBody += JSON.stringify(req.data);
                batchBody += `\r\n`;
            });
            batchBody += `--${boundary}--\r\n`;

            const batchUrl = `${baseUrl}/api/data/batch/v1?account=${account}&company=${company}&transactional=${transactional}`;

            const headers = {
                'Content-Type': `multipart/mixed; boundary="${boundary}"`,
                'Authorization': `Bearer ${token}`,
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID'],
                'X-Client-ID': destination.destinationConfiguration['URL.headers.X-Client-ID'],
                'X-Client-Version': destination.destinationConfiguration['URL.headers.X-Client-Version']
            };

            const response = await axios.post(batchUrl, batchBody, { headers });
            return this._parseBatchResponse(response.data, response.headers['content-type']);

        } catch (error) {
            console.error('FSMService: Batch Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Parse multipart batch response.
     * @private
     */
    _parseBatchResponse(responseBody, contentType) {
        const results = [];
        try {
            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            if (!boundaryMatch) return results;

            const boundary = boundaryMatch[1].replace(/"/g, '');
            const parts = responseBody.split(`--${boundary}`);

            for (const part of parts) {
                if (!part.trim() || part.trim() === '--') continue;
                const jsonMatch = part.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        const jsonData = JSON.parse(jsonMatch[0]);
                        const statusMatch = part.match(/HTTP\/1\.1 (\d+)/);
                        const status = statusMatch ? parseInt(statusMatch[1]) : 200;
                        const contentIdMatch = part.match(/Content-ID:\s*(\w+)/i);
                        results.push({
                            success: status >= 200 && status < 300,
                            status,
                            contentId: contentIdMatch ? contentIdMatch[1] : null,
                            data: jsonData
                        });
                    } catch (parseError) {
                        results.push({ success: false, status: 500, error: 'Failed to parse response' });
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing batch response:', error);
        }
        return results;
    }

    /**
     * Batch create multiple entries of different types.
     */
    async batchCreateEntries(entries, transactional = false) {
        const typeConfig = {
            'Expense': { path: '/Expense', dtos: 'Expense.17' },
            'Mileage': { path: '/Mileage', dtos: 'Mileage.19' },
            'Material': { path: '/Material', dtos: 'Material.22' },
            'TimeEffort': { path: '/TimeEffort', dtos: 'TimeEffort.17' }
        };

        const requests = entries.map(entry => {
            const config = typeConfig[entry.type];
            if (!config) throw new Error(`Unknown entry type: ${entry.type}`);
            return { method: 'POST', path: config.path, params: { dtos: config.dtos }, data: entry.payload };
        });

        const results = await this.makeBatchRequest(requests, transactional);
        const successCount = results.filter(r => r.success).length;
        return { success: results.filter(r => !r.success).length === 0, successCount, errorCount: results.filter(r => !r.success).length, totalCount: entries.length, results };
    }

    /**
     * Batch update multiple entries.
     */
    async batchUpdateEntries(entries, transactional = false) {
        const typeConfig = {
            'Expense': { path: '/Expense', dtos: 'Expense.17' },
            'Mileage': { path: '/Mileage', dtos: 'Mileage.19' },
            'Material': { path: '/Material', dtos: 'Material.22' },
            'TimeEffort': { path: '/TimeEffort', dtos: 'TimeEffort.17' }
        };

        const requests = entries.map(entry => {
            const config = typeConfig[entry.type];
            if (!config) throw new Error(`Unknown entry type: ${entry.type}`);
            if (!entry.id) throw new Error('Entry ID is required for update');
            return { method: 'PATCH', path: `${config.path}/${entry.id}`, params: { dtos: config.dtos, forceUpdate: true }, data: entry.payload };
        });

        const results = await this.makeBatchRequest(requests, transactional);
        return { success: results.filter(r => !r.success).length === 0, successCount: results.filter(r => r.success).length, errorCount: results.filter(r => !r.success).length, totalCount: entries.length, results };
    }

    /**
     * Batch delete multiple entries.
     */
    async batchDeleteEntries(entries, transactional = false) {
        const typeConfig = {
            'Expense': { path: '/Expense' },
            'Mileage': { path: '/Mileage' },
            'Material': { path: '/Material' },
            'TimeEffort': { path: '/TimeEffort' }
        };

        const requests = entries.map(entry => {
            const config = typeConfig[entry.type];
            if (!config) throw new Error(`Unknown entry type: ${entry.type}`);
            if (!entry.id) throw new Error('Entry ID is required for delete');
            if (!entry.lastChanged) throw new Error('lastChanged is required for delete');
            return { method: 'DELETE', path: `${config.path}/${entry.id}`, params: { lastChanged: entry.lastChanged } };
        });

        const results = await this.makeBatchRequest(requests, transactional);
        return { success: results.filter(r => !r.success).length === 0, successCount: results.filter(r => r.success).length, errorCount: results.filter(r => !r.success).length, totalCount: entries.length, results };
    }

    // ========================================
    // CRUD OPERATIONS
    // ========================================

    async updateExpense(expenseId, expenseData) { return this.patchRequest(`/Expense/${expenseId}`, expenseData, { dtos: 'Expense.17' }); }
    async createExpense(expenseData) { return this.postRequest('/Expense', expenseData, { dtos: 'Expense.17' }); }
    async createMileage(mileageData) { return this.postRequest('/Mileage', mileageData, { dtos: 'Mileage.19' }); }
    async updateMileage(mileageId, mileageData) { return this.patchRequest(`/Mileage/${mileageId}`, mileageData, { dtos: 'Mileage.19' }); }
    async createMaterial(materialData) { return this.postRequest('/Material', materialData, { dtos: 'Material.22' }); }
    async createTimeEffort(timeEffortData) { return this.postRequest('/TimeEffort', timeEffortData, { dtos: 'TimeEffort.17' }); }
    async updateMaterial(materialId, materialData) { return this.patchRequest(`/Material/${materialId}`, materialData, { dtos: 'Material.22' }); }
    async updateTimeEffort(timeEffortId, timeEffortData) { return this.patchRequest(`/TimeEffort/${timeEffortId}`, timeEffortData, { dtos: 'TimeEffort.17' }); }
    async getActivityById(activityId) { return this.makeRequest(`/Activity/${activityId}`, { dtos: 'Activity.40' }); }
    async getActivityByCode(activityCode) { return this.makeRequest(`/Activity/externalId/${activityCode}`, { dtos: 'Activity.40' }); }

    /**
     * Get activities for service call using composite-tree API.
     */
    async getActivitiesForServiceCall(serviceCallId) {
        try {
            const destination = await DestinationService.getDestination('FSM_OAUTH_CONNECT');
            const token = await TokenCache.getToken(destination);

            const baseUrl = destination.destinationConfiguration.URL;
            const fullUrl = `${baseUrl}/api/service-management/v2/composite-tree/service-calls/${serviceCallId}`;

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Client-ID': 'FSM_EXTENSION',
                'X-Client-Version': '1.0.0',
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID']
            };

            const response = await axios.get(fullUrl, { headers });
            return response.data;
        } catch (error) {
            console.error('FSMService: Composite-tree API Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Update activity.
     */
    async updateActivity(activityId, updateData) {
        const destination = await DestinationService.getDestination('FSM_OAUTH_CONNECT');
        const token = await TokenCache.getToken(destination);

        const baseUrl = destination.destinationConfiguration.URL;
        const fullUrl = `${baseUrl}/api/data/v4/Activity/${activityId}`;

        const queryParams = {
            dtos: 'Activity.40',
            account: destination.destinationConfiguration.account || this.config.account,
            company: destination.destinationConfiguration.company || this.config.company
        };

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
            'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID'],
            'X-Client-ID': destination.destinationConfiguration['URL.headers.X-Client-ID'],
            'X-Client-Version': destination.destinationConfiguration['URL.headers.X-Client-Version']
        };

        const response = await axios.put(fullUrl, updateData, { params: queryParams, headers });
        return response.data;
    }

    /**
     * Make Query API request (/api/query/v1 endpoints).
     */
    async makeQueryRequest(query, dtos) {
        try {
            const destination = await DestinationService.getDestination('FSM_OAUTH_CONNECT');
            const token = await TokenCache.getToken(destination);

            const baseUrl = destination.destinationConfiguration.URL;
            const queryUrl = `${baseUrl}/api/query/v1`;

            const queryParams = {
                query,
                dtos,
                account: destination.destinationConfiguration.account || this.config.account,
                company: destination.destinationConfiguration.company || this.config.company
            };

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID'],
                'X-Client-ID': destination.destinationConfiguration['URL.headers.X-Client-ID'],
                'X-Client-Version': destination.destinationConfiguration['URL.headers.X-Client-Version']
            };

            const response = await axios.get(queryUrl, { params: queryParams, headers });
            return response.data;

        } catch (error) {
            console.error('FSMService: Query API Error:', error.response?.data || error.message);
            throw error;
        }
    }

    // ========================================
    // T&M ENTRY RETRIEVAL
    // ========================================

    async getTimeEffortsForActivity(activityId) {
        try {
            const query = `SELECT timeEffort FROM TimeEffort timeEffort WHERE timeEffort.object.objectId = '${activityId}'`;
            const data = await this.makeQueryRequest(query, 'TimeEffort.17');
            if (!data.data || data.data.length === 0) return [];

            return data.data.map(item => {
                const te = item.timeEffort;
                let durationMinutes = 'N/A', durationHrs = 0;
                if (te.startDateTime && te.endDateTime) {
                    durationMinutes = Math.round((new Date(te.endDateTime) - new Date(te.startDateTime)) / 60000);
                    durationHrs = Math.round((durationMinutes / 60) * 100) / 100;
                }
                return {
                    id: te.id, lastChanged: te.lastChanged, createDateTime: te.createDateTime,
                    createPerson: te.createPerson || 'N/A', orgLevel: te.orgLevel || 'N/A',
                    chargeOption: te.chargeOption || 'N/A', task: te.task || 'N/A',
                    startDateTime: te.startDateTime || null, endDateTime: te.endDateTime || null,
                    sortDate: te.startDateTime || te.createDateTime || null,
                    udfValues: te.udfValues || [], durationMinutes, durationHrs,
                    remarksText: te.internalRemarks || te.remarks || 'N/A',
                    type: 'Time Effort', durationText: typeof durationMinutes === 'number' ? `${durationMinutes} min` : 'N/A',
                    fullData: te
                };
            });
        } catch (error) {
            console.error('FSMService: Error fetching time efforts:', error.message);
            return [];
        }
    }

    async getMaterialsForActivity(activityId) {
        try {
            const query = `SELECT w FROM Material w WHERE w.object.objectId = '${activityId}'`;
            const data = await this.makeQueryRequest(query, 'Material.22');
            if (!data.data || data.data.length === 0) return [];

            return data.data.map(item => {
                const m = item.w;
                return {
                    id: m.id, lastChanged: m.lastChanged, createDateTime: m.createDateTime,
                    createPerson: m.createPerson || 'N/A', orgLevel: m.orgLevel || 'N/A',
                    chargeOption: m.chargeOption || 'N/A', date: m.date || null,
                    sortDate: m.date ? `${m.date}T00:00:00Z` : (m.createDateTime || null),
                    quantity: m.quantity || 0, remarks: m.remarks || null,
                    itemDisplayText: m.item || 'N/A', type: 'Material',
                    quantityText: m.quantity ? `${m.quantity}` : 'N/A',
                    dateText: m.date || 'N/A', remarksText: m.remarks || 'N/A', fullData: m
                };
            });
        } catch (error) {
            console.error('FSMService: Error fetching materials:', error.message);
            return [];
        }
    }

    async getExpensesForActivity(activityId) {
        try {
            const query = `SELECT w FROM Expense w WHERE w.object.objectId = '${activityId}'`;
            const data = await this.makeQueryRequest(query, 'Expense.17');
            if (!data.data || data.data.length === 0) return [];

            return data.data.map(item => {
                const e = item.w;
                const externalAmount = e.externalAmount ? `${e.externalAmount.amount} ${e.externalAmount.currency}` : 'N/A';
                return {
                    id: e.id, lastChanged: e.lastChanged, createDateTime: e.createDateTime,
                    createPerson: e.createPerson || 'N/A', orgLevel: e.orgLevel || 'N/A',
                    date: e.date || null, sortDate: e.date ? `${e.date}T00:00:00Z` : (e.createDateTime || null),
                    externalAmount: e.externalAmount, internalAmount: e.internalAmount,
                    udfValues: e.udfValues || [], type: 'Expense',
                    dateText: e.date || 'N/A', expenseTypeText: e.type || 'N/A',
                    externalAmountText: externalAmount, remarksText: e.remarks || 'N/A', fullData: e
                };
            });
        } catch (error) {
            console.error('FSMService: Error fetching expenses:', error.message);
            return [];
        }
    }

    async getMileagesForActivity(activityId) {
        try {
            const query = `SELECT w FROM Mileage w WHERE w.object.objectId = '${activityId}'`;
            const data = await this.makeQueryRequest(query, 'Mileage.19');
            if (!data.data || data.data.length === 0) return [];

            return data.data.map(item => {
                const m = item.w;
                let travelDurationMinutes = 'N/A';
                if (m.travelStartDateTime && m.travelEndDateTime) {
                    travelDurationMinutes = Math.round((new Date(m.travelEndDateTime) - new Date(m.travelStartDateTime)) / 60000);
                }
                return {
                    id: m.id, lastChanged: m.lastChanged, createDateTime: m.createDateTime,
                    createPerson: m.createPerson || 'N/A', orgLevel: m.orgLevel || 'N/A',
                    date: m.date || null, sortDate: m.date ? `${m.date}T00:00:00Z` : (m.createDateTime || null),
                    source: m.source || 'N/A', destination: m.destination || 'N/A',
                    distance: m.distance || 0, distanceUnit: m.distanceUnit || 'KM',
                    driver: m.driver || false, privateCar: m.privateCar || false,
                    travelDurationMinutes, udfValues: m.udfValues || [], type: 'Mileage',
                    dateText: m.date || 'N/A',
                    distanceText: m.distance && m.distanceUnit ? `${m.distance} ${m.distanceUnit}` : 'N/A',
                    travelDurationText: typeof travelDurationMinutes === 'number' ? `${travelDurationMinutes} min` : 'N/A',
                    remarksText: m.remarks || 'N/A', fullData: m
                };
            });
        } catch (error) {
            console.error('FSMService: Error fetching mileages:', error.message);
            return [];
        }
    }

    // ========================================
    // LOOKUP DATA
    // ========================================

    async getTimeTasks() {
        try {
            const data = await this.makeRequest('/TimeTask', { dtos: 'TimeTask.18', fields: 'name,id,code' });
            if (!data.data || data.data.length === 0) return [];
            return data.data.map(item => ({ id: item.timeTask.id, code: item.timeTask.code, name: item.timeTask.name }));
        } catch (error) { console.error('FSMService: Error fetching time tasks:', error.message); return []; }
    }

    async getItems() {
        try {
            const query = `SELECT DISTINCT w.name, w.externalId, w.id FROM Item w WHERE w.tool = false AND w.externalId NOT LIKE 'Z11%'`;
            const data = await this.makeQueryRequest(query, 'Item.24');
            if (!data.data || data.data.length === 0) return [];
            return data.data.map(item => ({ id: item.w.id, externalId: item.w.externalId, name: item.w.name }));
        } catch (error) { console.error('FSMService: Error fetching items:', error.message); return []; }
    }

    async getExpenseTypes() {
        try {
            const data = await this.makeRequest('/ExpenseType', { dtos: 'ExpenseType.17', fields: 'name,id,code' });
            if (!data.data || data.data.length === 0) return [];
            return data.data.map(item => ({ id: item.expenseType.id, code: item.expenseType.code, name: item.expenseType.name }));
        } catch (error) { console.error('FSMService: Error fetching expense types:', error.message); return []; }
    }

    async getUdfMetaById(udfMetaId) {
        try {
            const query = `SELECT w.externalId FROM UdfMeta w WHERE w.id = '${udfMetaId}'`;
            const data = await this.makeQueryRequest(query, 'UdfMeta.20');
            if (!data.data || data.data.length === 0) return null;
            return data.data[0]?.w?.externalId || null;
        } catch (error) { console.error('FSMService: Error fetching UDF Meta:', error.message); return null; }
    }

    // ========================================
    // APPROVAL STATUS
    // ========================================

    async getApprovalStatusBatch(objectIds) {
        try {
            if (!objectIds || objectIds.length === 0) return {};
            const statusMap = {};
            const promises = objectIds.map(async (objectId) => {
                try {
                    const query = `SELECT w.decisionStatus FROM Approval w WHERE w.object.objectId = '${objectId}'`;
                    const data = await this.makeQueryRequest(query, 'Approval.15');
                    if (data.data && data.data.length > 0) {
                        const ds = data.data[0]?.w?.decisionStatus;
                        if (ds) statusMap[objectId] = ds;
                    }
                } catch (err) { console.error('FSMService: Error fetching approval for', objectId, ':', err.message); }
            });
            await Promise.all(promises);
            return statusMap;
        } catch (error) { console.error('FSMService: Error fetching approval statuses batch:', error.message); return {}; }
    }

    // ========================================
    // PERSON / USER DATA
    // ========================================

    async getPersons() {
        try {
            const query = `SELECT w.id, w.externalId, w.firstName, w.lastName FROM Person w WHERE w.externalId IS NOT NULL`;
            const data = await this.makeQueryRequest(query, 'Person.25');
            if (!data.data || data.data.length === 0) return [];
            return data.data.map(item => ({ id: item.w.id, externalId: item.w.externalId, firstName: item.w.firstName || '', lastName: item.w.lastName || '' }));
        } catch (error) { console.error('FSMService: Error fetching persons:', error.message); return []; }
    }

    async getPersonById(personId) {
        try {
            if (!personId) return null;
            const query = `SELECT w.id, w.externalId, w.firstName, w.lastName FROM Person w WHERE w.id = '${personId}'`;
            const data = await this.makeQueryRequest(query, 'Person.25');
            if (!data.data || data.data.length === 0) return null;
            return { id: data.data[0].w.id, externalId: data.data[0].w.externalId, firstName: data.data[0].w.firstName || '', lastName: data.data[0].w.lastName || '' };
        } catch (error) { console.error('FSMService: Error fetching person by ID:', error.message); return null; }
    }

    async getPersonByExternalId(externalId) {
        try {
            if (!externalId) return null;
            const query = `SELECT w.id, w.externalId, w.firstName, w.lastName FROM Person w WHERE w.externalId = '${externalId}'`;
            const data = await this.makeQueryRequest(query, 'Person.25');
            if (!data.data || data.data.length === 0) return null;
            return { id: data.data[0].w.id, externalId: data.data[0].w.externalId, firstName: data.data[0].w.firstName || '', lastName: data.data[0].w.lastName || '' };
        } catch (error) { console.error('FSMService: Error fetching person by externalId:', error.message); return null; }
    }

    async getBusinessPartnerByExternalId(externalId) {
        try {
            if (!externalId) return null;
            const query = `SELECT w.name FROM BusinessPartner w WHERE w.externalId = '${externalId}'`;
            const data = await this.makeQueryRequest(query, 'BusinessPartner.25');
            if (!data.data || data.data.length === 0) return null;
            return { externalId, name: data.data[0].w.name || '' };
        } catch (error) { console.error('FSMService: Error fetching business partner:', error.message); return null; }
    }

    // ========================================
    // ORGANIZATION LEVEL
    // ========================================

    async getOrganizationLevels() {
        try {
            const destination = await DestinationService.getDestination('FSM_OAUTH_CONNECT');
            const token = await TokenCache.getToken(destination);
            const baseUrl = destination.destinationConfiguration.URL;

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID']
            };

            const response = await axios.get(`${baseUrl}/cloud-org-level-service/api/v1/levels`, { headers });
            return response.data;
        } catch (error) {
            console.error('FSMService: Organizational-levels API Error:', error.response?.data || error.message);
            throw error;
        }
    }

    // ========================================
    // USER API
    // ========================================

    async getUserByUsername(username) {
        try {
            if (!username) return null;
            const destination = await DestinationService.getDestination('FSM_OAUTH_CONNECT');
            const token = await TokenCache.getToken(destination);
            const baseUrl = destination.destinationConfiguration.URL;
            const account = destination.destinationConfiguration.account || this.config.account;

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID'],
                'X-Client-ID': destination.destinationConfiguration['URL.headers.X-Client-ID'],
                'X-Client-Version': destination.destinationConfiguration['URL.headers.X-Client-Version']
            };

            const response = await axios.get(`${baseUrl}/api/user/v1/users`, { params: { name: username, account }, headers });
            if (response.data?.content?.length > 0) {
                const user = response.data.content[0];
                return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, name: user.name, companies: user.companies || [] };
            }
            return null;
        } catch (error) {
            console.error('FSMService: User API Error:', error.response?.data || error.message);
            throw error;
        }
    }

    async getPersonOrgLevelByUserId(userId) {
        try {
            if (!userId) return null;
            const query = `SELECT w.orgLevel, w.orgLevelIds FROM Person w WHERE w.userName = '${userId}'`;
            const data = await this.makeQueryRequest(query, 'Person.25');
            if (!data.data || data.data.length === 0) return null;
            const personData = data.data[0].w;
            return { orgLevel: personData.orgLevel || null, orgLevelIds: personData.orgLevelIds || null };
        } catch (error) {
            console.error('FSMService: Person orgLevel query Error:', error.response?.data || error.message);
            throw error;
        }
    }

    async getUserOrgLevel(username) {
        try {
            const user = await this.getUserByUsername(username);
            if (!user?.id) return null;
            const orgLevelData = await this.getPersonOrgLevelByUserId(user.id);
            if (!orgLevelData) return null;
            return { userId: user.id, userName: username, userFirstName: user.firstName, userLastName: user.lastName, orgLevel: orgLevelData.orgLevel, orgLevelIds: orgLevelData.orgLevelIds };
        } catch (error) {
            console.error('FSMService: getUserOrgLevel Error:', error.message);
            throw error;
        }
    }
}

module.exports = new FSMService();