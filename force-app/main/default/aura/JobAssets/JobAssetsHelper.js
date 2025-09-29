({
	doInit : function(component, event, helper) {
		var action = component.get('c.getDefault');
        var self = this;
        action.setParams({
		   JobId : component.get("v.recordId") 
		});
		
        action.setCallback(this, function(response) {
            var state = response.getState();
            if (state === "SUCCESS") {
                component.set('v.thirdLevelAccess',true);
                component.set('v.data', response.getReturnValue());
            } else if (state === "ERROR"){
                component.set('v.thirdLevelAccess',false);
                let errMsg = response.getError()[0].message;
                try{
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                }catch(e){
                    try{
                        if(!errMsg.includes('Third')){
                            self.toast.error(response.getError()[0].message);
                        }
                        return;
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
            }
        });
        $A.enqueueAction(action);
	}
})