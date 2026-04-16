/**
 * FSMService.js
 *
 * Backend service for SAP FSM (Field Service Management) API integration.
 * Provides UdoValue query and report building for checklist/report template configuration.
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
         * FSM configuration. Change destinationName here to switch BTP destination.
         * Account and company are read from the destination configuration.
         * @type {{destinationName: string}}
         */
        this.config = {
            destinationName: 'FSM_S4E'
        };
    }

    /**
     * Get authenticated destination + token + common headers.
     * @returns {Promise<{baseUrl: string, headers: Object, account: string, company: string}>}
     * @private
     */
    async _getConnection() {
        const destination = await DestinationService.getDestination(this.config.destinationName);
        const token = await TokenCache.getToken(destination);
        const cfg = destination.destinationConfiguration;

        return {
            baseUrl: cfg.URL,
            account: cfg.account,
            company: cfg.company,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Account-ID': cfg['URL.headers.X-Account-ID'],
                'X-Company-ID': cfg['URL.headers.X-Company-ID'],
                'X-Client-ID': cfg['URL.headers.X-Client-ID'],
                'X-Client-Version': cfg['URL.headers.X-Client-Version']
            }
        };
    }

    /**
     * Execute a query against the FSM Query API.
     * @param {Object} conn - Connection object from _getConnection()
     * @param {string} query - CQML query string
     * @param {string} dtos - DTO versions
     * @returns {Promise<Object>} API response data
     * @private
     */
    async _queryApi(conn, query, dtos) {
        const response = await axios.get(`${conn.baseUrl}/api/query/v1`, {
            params: {
                query,
                dtos,
                account: conn.account,
                company: conn.company
            },
            headers: conn.headers
        });
        return response.data;
    }

    /**
     * Resolve a ReportTemplate name to its UUID.
     * @param {Object} conn - Connection object from _getConnection()
     * @param {string} templateName - ReportTemplate name
     * @returns {Promise<string|null>} UUID or null
     * @private
     */
    async _getReportTemplateId(conn, templateName) {
        try {
            const query = `SELECT w.id FROM ReportTemplate w WHERE w.name = '${templateName}'`;
            const data = await this._queryApi(conn, query, 'ReportTemplate.20');

            if (!data.data || data.data.length === 0) {
                console.log('FSMService: No ReportTemplate found for name:', templateName);
                return null;
            }

            return data.data[0]?.w?.id || null;
        } catch (error) {
            console.error('FSMService: ReportTemplate query error:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Query UdoValue by cloudId and return checklist instance + report template UUID.
     *
     * Flow:
     * 1. Try query with z_Linker_Checklist_Instance1 = cloudId (UPPERCASE)
     * 2. If no results, try with z_Linker_Checklist_Instance2
     * 3. Extract z_Linker_PreliminaryReportTemplate name from udfValues
     * 4. Resolve template name to UUID via ReportTemplate query
     *
     * @param {string} cloudId - The FSM cloudId (will be upper-cased)
     * @returns {Promise<{checklistInstance: string|null, preliminaryReportTemplate: string|null}>}
     */
    async getUdoValues(cloudId) {
        try {
            const metaId = cloudId.toUpperCase();
            const conn = await this._getConnection();
            const dtos = 'UdoMeta.10;UdoValue.10';

            // Try Instance1 first
            const query1 = `SELECT v FROM UdoValue v JOIN UdoMeta m ON v.meta = m.id WHERE m.name = 'Linker_Object' AND v.udf.z_Linker_Checklist_Instance1 = '${metaId}'`;
            let data = await this._queryApi(conn, query1, dtos);

            // Fallback to Instance2 if no results
            if (!data.data || data.data.length === 0) {
                console.log('FSMService: Instance1 query returned no results, trying Instance2');
                const query2 = `SELECT v FROM UdoValue v JOIN UdoMeta m ON v.meta = m.id WHERE m.name = 'Linker_Object' AND v.udf.z_Linker_Checklist_Instance2 = '${metaId}'`;
                data = await this._queryApi(conn, query2, dtos);
            }

            if (!data.data || data.data.length === 0) {
                console.log('FSMService: No UdoValue results for cloudId:', metaId);
                return { checklistInstance: null, preliminaryReportTemplate: null };
            }

            const udfValues = data.data[0]?.v?.udfValues || [];

            const findValue = (name) => {
                const entry = udfValues.find(u => u.name === name);
                return entry?.value || null;
            };

            const checklistInstance =
                findValue('z_Linker_Checklist_Instance1') ||
                findValue('z_Linker_Checklist_Instance2');

            // Get template name, then resolve to UUID
            const templateName = findValue('z_Linker_PreliminaryReportTemplate');
            let preliminaryReportTemplate = null;

            if (templateName) {
                preliminaryReportTemplate = await this._getReportTemplateId(conn, templateName);
                console.log(`FSMService: Resolved template '${templateName}' -> ${preliminaryReportTemplate}`);
            }

            console.log('FSMService: UdoValues resolved:', { checklistInstance, preliminaryReportTemplate });

            return { checklistInstance, preliminaryReportTemplate };

        } catch (error) {
            console.error('FSMService: UdoValue query error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Build a report via the FSM Reporting API.
     *
     * @param {string} objectId - Checklist instance ID (z_Linker_Checklist_Instance)
     * @param {string} reportTemplateId - Report template UUID (z_Linker_PreliminaryReportTemplate)
     * @param {string} [language='de'] - Report language
     * @param {string} [reportType='PDF'] - Report output type
     * @returns {Promise<Buffer>} Raw PDF binary data
     */
    async buildReport(objectId, reportTemplateId, language = 'de', reportType = 'PDF') {
        try {
            const conn = await this._getConnection();

            const payload = {
                reportLanguage: language,
                reportParameters: {
                    objectId: objectId
                },
                reportTemplate: reportTemplateId,
                reportType: reportType
            };

            console.log('FSMService: Building report with payload:', JSON.stringify(payload, null, 2));

            const response = await axios.post(
                `${conn.baseUrl}/api/reporting/v1/build`,
                payload,
                {
                    params: {
                        account: conn.account,
                        company: conn.company
                    },
                    headers: conn.headers,
                    responseType: 'arraybuffer'
                }
            );

            console.log('FSMService: Report built successfully, size:', response.data.length, 'bytes');

            return response.data;

        } catch (error) {
            // Try to parse error response from arraybuffer
            if (error.response?.data) {
                try {
                    const errorText = Buffer.from(error.response.data).toString('utf-8');
                    const errorJson = JSON.parse(errorText);
                    console.error('FSMService: Report build error:', errorJson);
                    throw new Error(errorJson.message || 'Report build failed');
                } catch (parseErr) {
                    // Not JSON, log raw
                    console.error('FSMService: Report build error (raw):', error.response.status);
                }
            }
            console.error('FSMService: Report build error:', error.message);
            throw error;
        }
    }
}

module.exports = new FSMService();