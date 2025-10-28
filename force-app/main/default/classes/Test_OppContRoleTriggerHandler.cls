@isTest
public with sharing class Test_OppContRoleTriggerHandler {
    @isTest
    static void testCreateNewContactRoles(){
        TestDataFactory.jobdata(5);
        Test.startTest();
        Contact con = new Contact(LastName ='Test Contact');
        INSERT con;
        Opportunity opp = new Opportunity(Name='Test', CloseDate=System.today(),StageName='Closed Won',wfrecon__Job__c = [SELECT Id FROM wfrecon__Job__c][0].id);
        INSERT opp;
        List<OpportunityContactRole> oppConRoles = new List<OpportunityContactRole>();
        oppConRoles.add(new OpportunityContactRole(ContactId=con.id,OpportunityId=opp.id));
        oppConRoles.add(new OpportunityContactRole(ContactId=con.id,OpportunityId=opp.id));
        INSERT oppConRoles;
        Test.stopTest();
        System.assertEquals(2,  [SELECT Id FROM wfrecon__Job_Contact__c WHERE wfrecon__Job__c = :[SELECT Id FROM wfrecon__Job__c][0].id].size());
    }
}