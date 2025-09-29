({
	doInit : function(component, event, helper) {
		var action = component.get('c.getPickListValues');
              action.setParams({
    			'ObjName':'Mobilization_Group__c',
    			'FieldName':'Mobilization_Status__c'
    		});
    		action.setCallback(this, function(response) {
    			var state = response.getState();
    			if (state === "SUCCESS") {
    			   component.set("v.MobilizationStatuses",response.getReturnValue());
    			   component.set("v.mobilizationGrpObject.status",response.getReturnValue()[0] || '');
                    var status = component.get("v.mobilizationGrpObject.status");
    			   	
                    component.set('v.status',status);
    			}else if (state === "ERROR"){
                    try{
                        helper.toast.error(JSON.parse(response.getError()[0].message).message);
                    }catch(e){
                        try{
                        helper.toast.error(response.getError()[0].message);
                    }catch(err){
                        helper.toast.error(err.message);
                    };
                    }
                }
    		});
    		$A.enqueueAction(action);
	},

    // Fetch mobilization group details when record id is changed
    onRecordIdChanged: function(component, event, helper) {
        helper.fetchMobilizationGroupDetails(component);
    },

      SaveJob : function(component, event, helper){
        
        var JobId = component.find("popupJobId").get("v.selectedRecordId");
       
        if(JobId != null && JobId != ''){
            component.set("v.showSpinner", true);
            helper.SaveSchedule(component, event, helper);
            
        }else{
            helper.toast.error('please select a job!');
        }
    },
    deleteMob: function(component, event, helper){
        var msg ='Are you sure you want to delete this item?';
        if (!confirm(msg)) {
            component.set("v.isModalOpen", false);
            return false;
        } else {
            //Write your confirmed logic
        
        var action = component.get("c.deleteMobilizationGroup");
        component.set("v.showSpinner",true);
        var recordId = component.get("v.recordId");
        action.setParams({
            recordId : recordId
        });
        
        action.setCallback(this, function(response) {
            var state = response.getState();
            
            if(state === 'SUCCESS'){
                component.set("v.showSpinner",false);
                helper.toast.success('The Mobilization has been Deleted successfully.');
                component.set("v.isModalOpen", false);
                $A.get('e.force:refreshView').fire();               
            }else if(state === "ERROR"){
                try{
                    helper.toast.error(JSON.parse(response.getError()[0].message).message);
                }catch(e){
                    try{
                        helper.toast.error(response.getError()[0].message);
                    }catch(err){
                        helper.toast.error(err.message);
                    };
                }
            }
        });
        $A.enqueueAction(action);
        }
    
	},
     SaveJobdata : function(component, event, helper){
        var JobId = component.get("v.mobilizationGrpObject.jobId");
        if(JobId != null && JobId != ''){
            component.set("v.showSpinner", true);
            helper.SaveSchedule(component, event, helper);
        }else{
            helper.toast.error('please select a job!');
		    component.set("v.showSpinner", false);
        }
    },
    closeModel: function(component, event, helper) {
      // Set isModalOpen attribute to false  
      component.set("v.isModalOpen", false);
   },
    isRefreshed: function(component, event, helper) {
        component.set("v.showSpinner", true);
        location.reload();
        component.set("v.showSpinner", false);
    }
})