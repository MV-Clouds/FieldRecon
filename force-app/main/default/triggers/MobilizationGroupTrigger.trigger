trigger MobilizationGroupTrigger on Mobilization_Group__c (after insert,after update,before delete) {
    if(Trigger.isInsert){
        MobilizationGroupTriggerHandler.handleAfterInsert(Trigger.new);
    }else if(Trigger.isUpdate){
        MobilizationGroupTriggerHandler.handleAfterUpdate(Trigger.new,Trigger.oldMap);
    }else if(Trigger.isDelete && MobilizationGroupTriggerHandler.runOnce){
        MobilizationGroupTriggerHandler.handleBeforeDelete(Trigger.old);
    }
}