({
    doInit:function(component,event,helper){
        helper.getTimeSheetData(component,event,helper);
    },
    
    openTimeSheet: function (component, event, helper) { 
        var id = event.currentTarget.dataset.id;      
        var navEvt = $A.get("e.force:navigateToSObject"); 
        navEvt.setParams({
          "recordId": id
        });  
        navEvt.fire();
	},
	previousTimeSheet: function (component, event, helper) {
	    helper.getPreviousTimesheetData(component,event,helper);
	},
	nextTimeSheet: function (component, event, helper) {  
	    helper.getTimeSheetData(component,event,helper);
        component.set("v.isPreviousButtonActive", false); 
        component.set("v.isNextButtonActive", true); 
	},
	expandDesc : function(component, event, helper){
	    if(component.get('v.opensection') == event.getSource().get('v.value')){
                component.set('v.opensection',false);	
            }else{
                component.set('v.opensection',event.getSource().get('v.value'));
            }
            
	},
	expandDay : function(component, event, helper){
        
        if(component.get('v.openDay') == event.target.getAttribute("data-Id")){
            component.set('v.openDay',false);	
        }else{
            component.set('v.openDay',event.target.getAttribute("data-Id"));
        }
    }
})