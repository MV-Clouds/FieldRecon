({

    handleClose : function(component, event, helper) {
        var files = component.get('v.fileLists');
        if(files.length == 0){
            helper.toast.error("Please upload a receipt");
        }else{
            $A.get("e.force:closeQuickAction").fire()
        }
    },
    BackToRecord : function(component){
   // it returns only first value of Id
       var AcctId = component.get("v.recordId");
    
       var sObectEvent = $A.get("e.force:navigateToSObject");
        sObectEvent .setParams({
        "recordId": AcctId
       
       });
        sObectEvent.fire(); 
   },
})