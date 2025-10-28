trigger MobilizationTrigger on Mobilization__c (after insert,after Delete) {
    if(Trigger.isInsert){
        MobilizationTriggerHandler.handleAfterInsert(Trigger.new);
    }
    if(Trigger.isDelete && MobilizationGroupTriggerHandler.runOnce){
        MobilizationTriggerHandler.handleAfterDelete(Trigger.old);
    }
}