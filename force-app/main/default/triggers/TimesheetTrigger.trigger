trigger TimesheetTrigger on Timesheet__c (before update, after insert, after update) {
    
    TimesheetTriggerHandler handler = new TimesheetTriggerHandler(trigger.new, trigger.old, trigger.newMap, trigger.oldMap);
    
    if(trigger.isAfter){
        handler.AfterUpdateEvent();
    }
}