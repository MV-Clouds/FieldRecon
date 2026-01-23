trigger ContactTrigger on Contact (before insert) {

    if(Trigger.isInsert){
        ContactTriggerHandler.handleAfterInsert(trigger.new);
    }
}