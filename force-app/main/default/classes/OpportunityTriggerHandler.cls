public with sharing class OpportunityTriggerHandler {
    public static void handleAfterInsert(List<Opportunity> opportunities) {
        List<wfrecon__Job_Contact__c> jobContacts = new List<wfrecon__Job_Contact__c>();

        String query = 'SELECT Id,wfrecon__Job__c, (Select Contact.Id, Role from OpportunityContactRoles) ' 
            + ' FROM Opportunity WHERE Id IN :arg1 WITH SECURITY_ENFORCED';
        
        for(Opportunity opp : (Opportunity[])Lib_Security.ws().dbQuery(query, new Object[]{opportunities})){
            if(opp.OpportunityContactRoles.size() == 0){continue;}
            for(OpportunityContactRole oppConRole : opp.OpportunityContactRoles){
                jobContacts.add(new wfrecon__Job_Contact__c(wfrecon__Contact__c=oppConRole.Contact.Id,wfrecon__Job__c=opp.wfrecon__Job__c,wfrecon__Opportunity__c=opp.id));
            }
            
        }
        if(!jobContacts.isEmpty()){
            Lib_Security.ws().dbInsert(jobContacts);
        }
    }
    public static void handleAfterUpdate(List<Opportunity> opportunities,Map<Id,Opportunity> oldOpportunities) {
        Map<Id,Id> oppWithJob = new Map<Id,Id>();
        List<wfrecon__Job_Contact__c> jobContacts = new List<wfrecon__Job_Contact__c>();

        String query = 'SELECT Id,wfrecon__Job__c, (Select Contact.Id, Role from OpportunityContactRoles) ' 
            + ' FROM Opportunity WHERE Id IN :arg1 WITH SECURITY_ENFORCED';
        
        for(Opportunity opp : (Opportunity[])Lib_Security.ws().dbQuery(query, new Object[]{opportunities})){
            if(opp.wfrecon__Job__c != oldOpportunities.get(opp.id).wfrecon__Job__c){
                oppWithJob.put(oldOpportunities.get(opp.id).wfrecon__Job__c,opp.Id);
            }
            if(opp.OpportunityContactRoles.size() == 0 || opp.wfrecon__Job__c == null){continue;}
            for(OpportunityContactRole oppConRole : opp.OpportunityContactRoles){
                jobContacts.add(new wfrecon__Job_Contact__c(wfrecon__Contact__c=oppConRole.Contact.Id,wfrecon__Job__c=opp.wfrecon__Job__c,wfrecon__Opportunity__c=opp.id));
            }
            
        }
        System.debug(oppWithJob);
        if(oppWithJob != null){
            String soql = 'SELECT Id FROM wfrecon__Job_Contact__c WHERE wfrecon__Job__c IN :arg1 AND wfrecon__Opportunity__c IN :arg2';
            wfrecon__Job_Contact__c[] jobContactsToBeDeleted = Lib_Security.ws().dbQuery(soql, new Object[]{oppWithJob.keySet(),oppWithJob.values()});
            if(!jobContactsToBeDeleted.isEmpty()){
                Lib_Security.ws().dbDelete(jobContactsToBeDeleted);
            }
        }
        System.debug(jobContacts);
        if(!jobContacts.isEmpty()){
            Lib_Security.ws().dbInsert(jobContacts);
        }
    }
}