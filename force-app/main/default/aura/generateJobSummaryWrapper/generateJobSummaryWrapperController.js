({
	doInit : function(component, event, helper) {
        console.log('recordId : ', component.get("v.recordId"))
        // component.set("v.recordId",component.get("v.recordId"));
    },
	handleCloseEvent : function(component, event, helper) {
		$A.get("e.force:closeQuickAction").fire();
	}
})