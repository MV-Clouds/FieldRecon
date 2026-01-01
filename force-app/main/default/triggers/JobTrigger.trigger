trigger JobTrigger on Job__c (after insert, after update, after delete) {
    
    if (Trigger.isAfter && Trigger.isInsert) {
        JobTriggerHandler.createDefaultLocations(Trigger.new);
    }

    if(Trigger.isUpdate || Trigger.isDelete){
        JobTriggerHandler.handleAfter(Trigger.new, Trigger.old, Trigger.isUpdate, Trigger.isDelete);
    }
}