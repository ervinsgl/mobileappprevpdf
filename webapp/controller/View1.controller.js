sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], (Controller, JSONModel) => {
    "use strict";

    return Controller.extend("mobileappprevrep.controller.View1", {

        onInit() {
            this.getView().setModel(new JSONModel({
                busy: true,
                contextLoaded: false,
                showError: false,
                context: {}
            }), "view");

            this._loadContext();
        },

        /**
         * Fetch the FSM Mobile session context from the backend.
         *
         * The backend stores one context slot per user+object (session key)
         * and passes the key as a URL query param on redirect.
         * We read it from the current URL and send it back on the GET request
         * so each user retrieves exactly their own context.
         */
        _loadContext() {
            const oModel = this.getView().getModel("view");

            // Read session key injected by the server redirect:
            // POST /web-container-access-point → redirect /?session=<key>
            const params = new URLSearchParams(window.location.search);
            const sessionKey = params.get("session");

            const url = sessionKey
                ? `/web-container-context?session=${encodeURIComponent(sessionKey)}`
                : "/web-container-context";

            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    return response.json();
                })
                .then(context => {
                    oModel.setProperty("/context", context);
                    oModel.setProperty("/contextLoaded", true);
                    oModel.setProperty("/busy", false);

                    console.log("FSM context loaded:", {
                        user: context.userName,
                        company: context.companyName,
                        objectType: context.objectType,
                        session: sessionKey
                    });
                })
                .catch(error => {
                    console.warn("FSM context not available:", error.message);
                    oModel.setProperty("/showError", true);
                    oModel.setProperty("/busy", false);
                });
        }

    });
});