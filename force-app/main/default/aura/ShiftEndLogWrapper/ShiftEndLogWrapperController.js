({
	doInit : function(component, event, helper) {
        var action = component.get('c.checkLevelAccess');
		action.setCallback(this, function (response) {
			var state = response.getState();
            if (state === "SUCCESS") {
				component.set("v.thirdLevelAccess",response.getReturnValue());
			}
			else if(state === "ERROR"){
				component.set("v.thirdLevelAccess",false);
			}
		});
        $A.enqueueAction(action);
    },
	handleCloseEvent : function(component, event, helper) {
		$A.get("e.force:closeQuickAction").fire();
	}
})