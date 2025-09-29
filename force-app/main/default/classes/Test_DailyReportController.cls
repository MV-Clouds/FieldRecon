@isTest
public class Test_DailyReportController {
    @isTest
    public static void test() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            TestDataFactory.contentData(100);
            TestDataFactory.jobdata(100);

            system.assert(TestDataFactory.jobList[0].Id != null, 'job id is not null');
            ApexPages.StandardController stdJob = new ApexPages.StandardController(TestDataFactory.jobList[0]);
            Test.startTest();
            DailyReportController dpr = new DailyReportController(stdJob);
            Test.stopTest();
        }
    }
}