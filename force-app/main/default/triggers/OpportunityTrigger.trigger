trigger OpportunityTrigger on Opportunity (after insert,after update) {
    List<Opportunity> opportunities = new List<Opportunity>();
    if(Trigger.isInsert){
        for(Opportunity opp : Trigger.new){
            if(opp.wfrecon__Job__c != null){
                opportunities.add(opp);
            }
        }
        if(opportunities.isEmpty()){return;}
        OpportunityTriggerHandler.handleAfterInsert(opportunities);
    }if(Trigger.isUpdate){
        for(Opportunity opp : Trigger.new){
            if((Trigger.oldMap.get(opp.id).wfrecon__Job__c != null && opp.wfrecon__Job__c == null) || opp.wfrecon__Job__c != Trigger.oldMap.get(opp.id).wfrecon__Job__c){
                opportunities.add(opp);
            }
        }
        if(opportunities.isEmpty()){return;}
        OpportunityTriggerHandler.handleAfterUpdate(opportunities,Trigger.oldMap);
    }
}