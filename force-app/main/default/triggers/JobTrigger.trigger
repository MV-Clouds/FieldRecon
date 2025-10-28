trigger JobTrigger on Job__c (after insert) {
    
    if (Trigger.isAfter && Trigger.isInsert) {
        JobTriggerHandler.createDefaultLocations(Trigger.new);
    }
}