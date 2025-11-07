trigger ContactTrigger on Contact (before insert,before update) {
    if(Trigger.isInsert || Trigger.isUpdate){
        ContactTriggerHandler.addUsersToContacts(Trigger.new);
    }   
}