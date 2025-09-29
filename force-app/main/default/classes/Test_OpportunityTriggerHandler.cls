@isTest
public with sharing class Test_OpportunityTriggerHandler {
    @TestSetup
    static void setupData(){
        TestDataFactory.jobdata(5);
        Contact con = new Contact(LastName ='Test Contact');
        INSERT con;
        Opportunity opp = new Opportunity(Name='Test', CloseDate=System.today(),StageName='Closed Won');
        INSERT opp;
        List<OpportunityContactRole> oppConRoles = new List<OpportunityContactRole>();
        oppConRoles.add(new OpportunityContactRole(ContactId=con.id,OpportunityId=opp.id));
        oppConRoles.add(new OpportunityContactRole(ContactId=con.id,OpportunityId=opp.id));
        INSERT oppConRoles;
    }
    @isTest
    static void testChangeJobOnOpportunity(){
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c][0];
        Opportunity opp = [SELECT Id,wfrecon__Job__c FROM Opportunity][0];
        opp.wfrecon__Job__c = job.Id;
        Test.startTest();
        UPDATE opp;
        Test.stopTest();
        System.assertEquals(2, [SELECT Id FROM wfrecon__Job_Contact__c WHERE wfrecon__Job__c = :job.id].size());
    }
    @isTest
    static void testAddNewJobOnOpportunity(){
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c][1];
        Test.startTest();
        Opportunity opp = new Opportunity(Name='Test', CloseDate=System.today(),StageName='Closed Won',wfrecon__Job__c=job.Id);
        INSERT opp;
        List<OpportunityContactRole> oppConRoles = new List<OpportunityContactRole>();
        oppConRoles.add(new OpportunityContactRole(ContactId=[SELECT Id FROM Contact][0].id,OpportunityId=opp.id));
        INSERT oppConRoles;
        Test.stopTest();
        System.assertEquals(1, [SELECT Id FROM wfrecon__Job_Contact__c WHERE wfrecon__Job__c = :job.id].size());
    }
}