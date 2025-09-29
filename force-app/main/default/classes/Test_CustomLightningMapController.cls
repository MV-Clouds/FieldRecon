@isTest
public class Test_CustomLightningMapController {
    @isTest
    public static void test() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            TestDataFactory.jobdata(2);
            String JobId = TestDataFactory.jobList[1].Id;
            System.assert(JobId != null, 'JobId is not null');
            customLightningMapController.getDefaults(JobId);
        }
    }
}