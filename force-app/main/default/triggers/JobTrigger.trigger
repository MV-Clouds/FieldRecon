trigger JobTrigger on wfrecon__Job__c (after insert, after update) {
    
    if (Trigger.isAfter && Trigger.isInsert) {
        JobTriggerHandler.createDefaultLocations(Trigger.new);
    }


    if(Trigger.isAfter && Trigger.isUpdate){
        
        // On Job Close, Generate Job Report and Job Summary
        JobTriggerHandler.generateJobSummary(Trigger.new, Trigger.oldMap);
    }
}