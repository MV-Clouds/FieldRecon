@isTest
public class Test_JobAssetListController {
    @isTest
    public static void test() {
        System.FeatureManagement.setPackageBooleanValue('Level_III_User',true);
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            TestDataFactory.createAccountData(10);
            TestDataFactory.contactData(10);
            TestDataFactory.jobdata(10);
            TestDataFactory.mobdata(10);
            TestDataFactory.AssetData(10);
            TestDataFactory.MobAssetData(10);
            test.startTest();
            JobAssetListController.getDefault(TestDataFactory.jobList[0].Id);
            System.assert(TestDataFactory.jobList[0].Id != null, 'jobId is not null');
            test.stopTest();

        }
    }
}