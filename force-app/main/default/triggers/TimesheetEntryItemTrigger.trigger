trigger TimesheetEntryItemTrigger on Timesheet_Entry_Item__c (after insert) {
    
    TimesheetEntryItemTriggerHandler handler = new TimesheetEntryItemTriggerHandler(trigger.new, trigger.old, trigger.newMap, trigger.oldMap);
    
    if(trigger.isAfter){
        if(trigger.isInsert){
            handler.AfterInsertEvent();
        }
    }
    
}