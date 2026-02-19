/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["mobileappwebcontainer/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
