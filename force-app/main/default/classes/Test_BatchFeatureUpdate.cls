@isTest
public class Test_BatchFeatureUpdate {
    @TestSetup
    static void makeData(){
        Profile customP = [SELECT Id FROM Profile WHERE Name='System Administrator']; 
        User u = new User(Alias = 'standt', Email='testContact@testing.com', 
            EmailEncodingKey='UTF-8', FirstName = 'Test',LastName = 'Contact-1', LanguageLocaleKey='en_US', 
            LocaleSidKey='en_US', ProfileId = customP.Id, 
            TimeZoneSidKey='America/Los_Angeles',UserName = 'testing1231798@testing.com');
        INSERT u;
        PermissionSet ps = [ SELECT Id FROM PermissionSet WHERE Name = 'WF_Recon_Level_1' ];
        PermissionSetAssignment psa = new PermissionSetAssignment(AssigneeId = u.Id,PermissionSetId = ps.Id);
        INSERT psa;
    }
    @isTest
    static void checkSecondLevelFeature(){
        Test.startTest();
        System.FeatureManagement.setPackageBooleanValue('Level_II_User',true);
        System.FeatureManagement.setPackageBooleanValue('Level_III_User',false);
        BatchFeatureUpdate bfu = new BatchFeatureUpdate();
        Database.executebatch(bfu);
        Test.stopTest();
        System.assert([SELECT Id, Assignee.Name, PermissionSet.Name FROM PermissionSetAssignment WHERE Assignee.Name = 'Test Contact-1' AND PermissionSet.Name = 'WF_Recon_Level_2'].size() > 0);
    }
    @isTest
    static void checkFirstLevelFeature(){
        Test.startTest();
        System.FeatureManagement.setPackageBooleanValue('Level_II_User',false);
        System.FeatureManagement.setPackageBooleanValue('Level_III_User',false);
        BatchFeatureUpdate bfu = new BatchFeatureUpdate();
        Database.executebatch(bfu);
        Test.stopTest();
        System.assert([SELECT Id, Assignee.Name, PermissionSet.Name FROM PermissionSetAssignment WHERE Assignee.Name = 'Test Contact-1' AND PermissionSet.Name = 'WF_Recon_Level_1'].size() > 0);
    }
    @isTest
    static void checkThirdLevelFeature(){
        Test.startTest();
        System.FeatureManagement.setPackageBooleanValue('Level_II_User',false);
        System.FeatureManagement.setPackageBooleanValue('Level_III_User',true);
        BatchFeatureUpdate bfu = new BatchFeatureUpdate();
        Database.executebatch(bfu);
        Test.stopTest();
        System.assert([SELECT Id, Assignee.Name, PermissionSet.Name FROM PermissionSetAssignment WHERE Assignee.Name = 'Test Contact-1' AND PermissionSet.Name = 'WF_Recon_Level_3'].size() > 0);
    }
}