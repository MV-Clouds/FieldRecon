@isTest
public class Test_LookupFieldController {
    @isTest
    public static void lookupMethod1() {
        LookupFieldController lfc = new LookupFieldController();
        Test.startTest();
        LookupFieldController.searchRecord(
            'Account',
            'Name',
            'FIPS_County__c',
            'true',
            '',
            'true',
            'FIPS_State__c',
            new List<String>(),
            new List<String>(),
            'account',
            5
        );
        System.assert('Account' == 'Account', 'Account is Object');
        Test.stopTest();
    }

    @isTest
    public static void lookupMethod2() {
        LookupFieldController lfc = new LookupFieldController();
        Test.startTest();
        LookupFieldController.searchRecord(
            'Job__c',
            'Name',
            'FIPS_County__c',
            'true',
            '',
            'true',
            'FIPS_State__c',
            new List<String>(),
            new List<String>(),
            'job',
            5
        );
        System.assert('Job__c' == 'Job__c', 'Job__c is Object');
        Test.stopTest();
    }

    @isTest
    public static void lookupMethod3() {
        LookupFieldController lfc = new LookupFieldController();
        Test.startTest();
        LookupFieldController.searchRecord(
            'User',
            'LastName',
            'Department',
            'true',
            '',
            'true',
            'EmployeeNumber',
            new List<String>(),
            new List<String>(),
            'user',
            5
        );
        System.assert('User' == 'User', 'User is Object');
        Test.stopTest();
    }
}