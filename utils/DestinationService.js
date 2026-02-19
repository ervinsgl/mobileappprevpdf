/**
 * DestinationService.js
 *
 * Backend service for SAP BTP Destination Service integration.
 * Retrieves destination configurations from BTP for FSM API connectivity.
 *
 * Key Features:
 * - Read Destination Service credentials from VCAP_SERVICES
 * - Authenticate with Destination Service using OAuth
 * - Fetch destination configuration by name
 *
 * Environment Requirements:
 * - VCAP_SERVICES must contain bound destination service
 * - Destination must be configured in BTP cockpit
 *
 * Destination Configuration Contains:
 * - URL: FSM API base URL
 * - tokenServiceURL: OAuth token endpoint
 * - clientId/clientSecret: OAuth credentials
 *
 * @file DestinationService.js
 * @module utils/DestinationService
 * @requires axios
 */
const axios = require('axios');

class DestinationService {
    /**
     * Get Destination Service credentials from VCAP_SERVICES.
     * @returns {Object} Destination service credentials
     * @throws {Error} If destination service is not bound
     */
    getCredentials() {
        const vcapServices = JSON.parse(process.env.VCAP_SERVICES || '{}');
        const destinationService = vcapServices.destination?.[0];

        if (!destinationService) {
            throw new Error('Destination service not bound to application');
        }

        return destinationService.credentials;
    }

    /**
     * Get destination configuration from BTP.
     * @param {string} destinationName - Name of the destination in BTP
     * @returns {Promise<Object>} Destination configuration
     * @throws {Error} If destination cannot be loaded
     */
    async getDestination(destinationName) {
        try {
            const credentials = this.getCredentials();

            const tokenResponse = await axios.post(
                credentials.url + '/oauth/token',
                new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: credentials.clientid,
                    client_secret: credentials.clientsecret
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            const accessToken = tokenResponse.data.access_token;

            const destinationResponse = await axios.get(
                `${credentials.uri}/destination-configuration/v1/destinations/${destinationName}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            return destinationResponse.data;

        } catch (error) {
            console.error('DestinationService: Error loading destination:', error.response?.data || error.message);
            throw new Error('Failed to load destination');
        }
    }
}

module.exports = new DestinationService();