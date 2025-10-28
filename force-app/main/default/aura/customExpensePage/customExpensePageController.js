({
    handleSubmit: function(component, event, helper) {
        event.preventDefault();       // stop the form from submitting
        var fields = event.getParam('fields');
        fields.Job__c = component.get('v.recordId');
        component.find('myRecordForm').submit(fields);
    },

    handleSuccess : function(component, event, helper) {
        var record = event.getParam("response");
        var myRecordId = record.id; // ID of updated or created record
        component.set("v.expenseRecordId",myRecordId);
    },
 
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