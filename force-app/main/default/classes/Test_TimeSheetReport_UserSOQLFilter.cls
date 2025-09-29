@isTest
public class Test_TimeSheetReport_UserSOQLFilter {
	@isTest
    public static void testPrepare(){
        TimeSheetReport_UserSOQLFilter test = new TimeSheetReport_UserSOQLFilter();
        String res = test.prepare('test','Contact','Name');
        System.assertEquals('RecordType.DeveloperName = \'Employee_WF_Recon\' AND User__c != null', res);
    }
}