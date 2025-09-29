trigger EquipmentTrigger on Equipment__c  (before insert, before update, before delete, after insert, after update, after delete, after undelete) {
    AssetTriggerHandler handler = new AssetTriggerHandler(trigger.new, trigger.old, trigger.newMap, trigger.oldMap, trigger.isInsert,trigger.isUpdate, trigger.isDelete, trigger.isUndelete);
    
    if(trigger.isBefore){
        if(trigger.isInsert){
            handler.BeforeInsertEvent();
        }else if(trigger.isUpdate){
            handler.BeforeUpdateEvent();
        }
    }else if(trigger.isAfter){
        if(trigger.isInsert){
            handler.AfterInsertEvent();
        }
    }
}