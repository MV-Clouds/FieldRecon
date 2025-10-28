trigger OpportunityContactRoleTrigger on OpportunityContactRole (after insert) {
    OpportunityContactRoleTriggerHandler.handleAfterInsert(Trigger.new);
}