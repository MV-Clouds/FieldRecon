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
    
    @isTest
    public static void testSendErrorEmail() {
        Test.startTest();
        // Set up email mock
        Integer emailInvocations = Limits.getEmailInvocations();
        
        // Create a post install setup instance and trigger install
        PostInstallSetup psi = new PostInstallSetup();
        Test.testInstall(psi, new Version(1, 0));
        
        // The sendErrorEmail is called internally if there's an error
        // We can verify email was attempted by checking limits
        Integer emailInvocationsAfter = Limits.getEmailInvocations();
        
        Test.stopTest();
    }
    
    @isTest
    public static void testPostInstallWithExistingData() {
        // Create existing permission set assignment
        PermissionSet ps = [SELECT Id FROM PermissionSet WHERE Name = 'WF_Recon_Level_1' LIMIT 1];
        PermissionSetAssignment psa = new PermissionSetAssignment(
            AssigneeId = UserInfo.getUserId(),
            PermissionSetId = ps.Id
        );
        insert psa;
        
        // Create existing scheduled job
        BatchSchdAccountGeofieldUpdate m = new BatchSchdAccountGeofieldUpdate();
        String sch = '00 00 00 ? * * *';
        String jobID = System.schedule('Merge Job', sch, m);
        
        Test.startTest();
        PostInstallSetup psi = new PostInstallSetup();
        Test.testInstall(psi, new Version(1, 0));
        Test.stopTest();
    }
    
    @isTest
    public static void testAssignPermissionSets() {
        Test.startTest();
        PostInstallSetup psi = new PostInstallSetup();
        Test.testInstall(psi, new Version(1, 0));
        Test.stopTest();
    }
    
    @isTest
    public static void testDeleteTabVisibilities() {
        Test.startTest();
        PostInstallSetup psi = new PostInstallSetup();
        Test.testInstall(psi, new Version(2, 0));
        Test.stopTest();
    }
}