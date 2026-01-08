({
    handleClose : function(component, event, helper) {
        // Try to read detail from different event types (DOM CustomEvent or Aura event)
        var detail = null;
            if (event && typeof event.getParam === 'function') {
                detail = event.getParam('detail');
            }
       
        if (!detail && event && event.detail) {
            detail = event.detail;
        }

        // Also check for nested detail structures
        if (detail && detail.detail) {
            detail = detail.detail;
        }

        // Close the quick action first so modal is dismissed
        $A.get("e.force:closeQuickAction").fire();

        // If an Id was provided, navigate to the record page after a short delay
        var recordId = detail && detail.id ? detail.id : null;
        if (!recordId && event && event.getParam) {
            try {
                recordId = event.getParam('id') || recordId;
            } catch (e) {}
        }

        if (recordId) {
            window.setTimeout(function() {
                var navEvt = $A.get("e.force:navigateToSObject");
                if (navEvt) {
                    navEvt.setParams({ "recordId": recordId, "slideDevName": "detail" });
                    navEvt.fire();
                    console.log('Navigated to Proposal:', recordId);
                } else {
                    console.warn('Navigation event not available.');
                }
            }, 300);
        } else {
            console.warn('No id provided in event detail; no navigation performed.');
        }
    }
})