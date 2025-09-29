public with sharing class OpportunityContactRoleTriggerHandler {
    public static void handleAfterInsert(List<OpportunityContactRole> oppConRoles) {
        List<wfrecon__Job_Contact__c> jobContacts = new List<wfrecon__Job_Contact__c>();
        Map<Id,Id> oppIds = new Map<Id,Id>();
        for(OpportunityContactRole oppConRole :oppConRoles ){
            if(oppConRole.OpportunityId == null) {continue;}
            oppIds.put(oppConRole.OpportunityId,oppConRole.ContactId);
        }
        String query = 'SELECT Id, wfrecon__Job__c,(Select Contact.Id, Role from OpportunityContactRoles) From Opportunity Where Id IN :arg1 AND wfrecon__Job__c != NULL';
        
        for(Opportunity opp : (Opportunity[])Lib_Security.ws().dbQuery(query, new Object[]{oppIds.keyset()})){
            if(opp.wfrecon__Job__c == null){continue;}
            for(OpportunityContactRole oppConRole : opp.OpportunityContactRoles){
                jobContacts.add(new wfrecon__Job_Contact__c(wfrecon__Contact__c=oppConRole.Contact.Id,wfrecon__Job__c=opp.wfrecon__Job__c,wfrecon__Opportunity__c=opp.id));
            }
        }
        if(!jobContacts.isEmpty()){
            Lib_Security.ws().dbInsert(jobContacts);
        }
    }
}