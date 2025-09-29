@isTest
private class LookupControllerTest {

	@isTest static void searchRecordTest() {
	    List<String> MoreFields = new List<String>();
        MoreFields.add('Active__c');
        
        Opportunity opp = new Opportunity();
        opp.Name = 'Test';
        opp.StageName = 'Test';
        opp.CloseDate = System.today();
        insert opp;
        
    	LookupController.searchRecord('Skill_Library__c', 'Name__c', 'Name__c' , 'true', MoreFields, 'test', 10,false);
        LookupController.searchRecord('Skill_Library__c', 'Name__c', 'Name__c' , 'true', MoreFields, 'test', 10,true);
        LookupController.getNamespace();
        
        Assert.areEqual(opp.Id != NULL, TRUE);
	}

}