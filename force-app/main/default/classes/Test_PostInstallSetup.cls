@isTest
public class Test_PostInstallSetup {
    @isTest
    public static void checkPostInstall() {
        PostInstallSetup psi = new PostInstallSetup();
        Test.startTest();
        Test.testInstall(psi,new Version(1,0));
        Test.stopTest();
        System.assert([SELECT Id, Assignee.Name, PermissionSet.Name FROM PermissionSetAssignment WHERE AssigneeId =:UserInfo.getUserId() AND PermissionSet.Name LIKE '%WF_Recon%'].size() > 0);
        System.assert([SELECT Id FROM CronJobDetail WHERE Name = 'Merge Job'].size() > 0);
    }
    @isTest
    public static void checkScheduledJob(){
        PageReference pageRef = Page.ScheduleFeatureTab;
        Test.startTest();
        Test.setCurrentPage(pageRef);
        ScheduleFeatureTabController  controller = new ScheduleFeatureTabController();
        controller.scheduleJob();
        Test.stopTest();
        System.assert([SELECT Id FROM CronJobDetail WHERE Name = 'FeatureJobSchd'].size() > 0);
    }
}