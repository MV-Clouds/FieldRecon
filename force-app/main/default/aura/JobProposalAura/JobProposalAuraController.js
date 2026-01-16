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

    }
})