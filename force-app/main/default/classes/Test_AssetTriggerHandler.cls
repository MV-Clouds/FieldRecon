@isTest
public class Test_AssetTriggerHandler {
    @isTest
    public static void test() {
        Account acc = new Account();
        acc.Name = 'Test Asset';
        insert acc;
        Contact con = new Contact();
        con.LastName = 'Test';
        con.AccountId = acc.Id;
        insert con;

        Equipment__c a = new Equipment__c();
        /*a.AccountId__c = acc.Id;
        a.ContactId__c = con.Id;*/
        a.Name = 'Test';
        insert a;
		
        Equipment__c eqp  = [ SELECT Id,Name,AccountId__r.Name,ContactId__r.Name FROM Equipment__c ];
        System.assertEquals('Asset Account', eqp.AccountId__r.Name);
        System.assertEquals('Asset Contact', eqp.ContactId__r.Name);
        
        //System.assert(a.AccountId__c != null, 'Account Id is not null');
        /*AssetTriggerHandler.getContactId();
        AssetTriggerHandler.getAccountId();*/
    }
}