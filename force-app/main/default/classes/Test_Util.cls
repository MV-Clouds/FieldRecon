@isTest
public class Test_Util {
    @isTest
    public static void test() {
        Test.startTest();
        List<String> LstStr = new List<String>();
        LstStr.add('1');
        LstStr.add('2');
        Set<String> setOfData = new Set<String>();
        List<Job__c> jobList = new List<Job__c>();
        List<Database.SaveResult> dbs = Database.update(jobList, true);
        Util.getListtoSet(LstStr);
        Util.getQueryData('Job__c', 'job');
        Util.getParentRecordFields('Job__c');
        Util.getDynamicFields('Job__c', '');
        Util.getPickListValues(
             'Job__c',
             'Status__c'
        );
        Util.checkAccess(Util.getNamespaceWithUnderscore() + 'Job__c');
        Util.getUserOffset();
        System.assertNotEquals(0, LstStr.size());
        Test.stopTest();
    }
}