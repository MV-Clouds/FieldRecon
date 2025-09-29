({
	getImages : function(component, event, helper){  
		var AssetId  = component.get("v.recordId");  
		var action = component.get("c.getContents");
        var self = this;
        action.setParams({
			"jobID" : AssetId,
			"fatchedRecordNo" : component.get("v.fatchedRecordNo")
		});
		
        action.setCallback(this, function(response) {
            var state = response.getState();
            if(component.isValid() && state === 'SUCCESS') {
                var result = response.getReturnValue();
                
                component.set('v.Galleryfiles', result);
            }else if (state === "ERROR"){
                try{
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                }catch(e){
                    try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
            }
        });
         $A.enqueueAction(action);
	 },
})