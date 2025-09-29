@isTest
public class Test_ControllerCustomWizard {
    @isTest
    public static void method1() {
        ControllerCustomWizard cc = new ControllerCustomWizard();
        cc.getInit();
        boolean sm;

        Reimbursement__c fr = new Reimbursement__c();
        fr.Name = 'test';
        fr.Driver_Reimbursement__c = 10;
        fr.Passenger_Reimbursement__c = 20;
        insert fr;

        fr.Name = 'test data';
        update fr;

        Reimbursement__c fr1 = new Reimbursement__c(Name ='Test');
        System.assertEquals(null, fr1.Id);

        Profile pf = [SELECT Id FROM Profile WHERE Name = 'System Administrator'];
        List<User> listUsr = new List<User>();

        User u = new User();
        u.FirstName = 'test';
        u.LastName = 'mv clouds';
        u.Alias = 'testmv';
        u.CommunityNickname = 'testmv';
        u.Email = 'test@mvclouds.com';
        u.Username = 'test@mvclouds.com';
        u.Phone = '1234567898';
        u.TimeZoneSidKey = 'America/Los_Angeles';
        u.EmailEncodingKey = 'UTF-8';
        u.LanguageLocaleKey = 'en_US';
        u.LocaleSidKey = 'en_US';
        u.ProfileId = pf.Id;
        u.IsActive = true;

        insert u;

        User u1 = new User();
        u1.FirstName = 'test1';
        u1.LastName = 'mv clouds1';
        u1.Alias = 'testmv1';
        u1.CommunityNickname = 'testmv1';
        u1.Email = 'test1@mvclouds.com';
        u1.Username = 'test1@mvclouds.com';
        u1.Phone = '1234567898';
        u1.TimeZoneSidKey = 'America/Los_Angeles';
        u1.EmailEncodingKey = 'UTF-8';
        u1.LanguageLocaleKey = 'en_US';
        u1.LocaleSidKey = 'en_US';
        u1.ProfileId = pf.Id;
        u1.IsActive = false;

        insert u1;

        User u2 = new User();
        u2.FirstName = 'test2';
        u2.LastName = 'mv clouds2';
        u2.Alias = 'testmv2';
        u2.CommunityNickname = 'testmv2';
        u2.Email = 'test2@mvclouds.com';
        u2.Username = 'test2@mvclouds.com';
        u2.Phone = '1234567898';
        u2.TimeZoneSidKey = 'America/Los_Angeles';
        u2.EmailEncodingKey = 'UTF-8';
        u2.LanguageLocaleKey = 'en_US';
        u2.LocaleSidKey = 'en_US';
        u2.ProfileId = pf.Id;
        u2.IsActive = true;

        Test.startTest();
        try{
        Default_Values__c dv = new Default_Values__c();
        dv.Name = 'Demo';
        dv.Max_Indicator_Distance__c = 10;
        dv.Week_Start_Day__c = 'test';

        insert dv;

        controllerCustomWizard.getMaxindicatordistance();
        controllerCustomWizard.updateStartweekday(new ControllerCustomWizard.DefaultValues(dv));
        controllerCustomWizard.updateDefaultValues(new ControllerCustomWizard.DefaultValues(dv));
        controllerCustomWizard.updateReimbursement(new ControllerCustomWizard.Reimbursement(fr));
        controllerCustomWizard.updateReimbursement(new ControllerCustomWizard.Reimbursement(fr1));
        controllerCustomWizard.fetchUser();
        controllerCustomWizard.fetchOrgTZone();
        controllerCustomWizard.fetchUserRole();
        controllerCustomWizard.fetchUserLicense();
        controllerCustomWizard.fetchProfile();
        controllerCustomWizard.fetchTimeZone();
        controllerCustomWizard.fetchLocale();
        controllerCustomWizard.fetchLanguage();
        controllerCustomWizard.fetchEmailEncoding();
        controllerCustomWizard.saveUserDetails(new ControllerCustomWizard.userWrapper(u));
        controllerCustomWizard.saveUserDetails(new ControllerCustomWizard.userWrapper(u2));
        System.runAs(u) {
            controllerCustomWizard.fetchAllUserDetails(u1.Id);
            controllerCustomWizard.activeInActiveUser(u1.Id);
            controllerCustomWizard.activeInActiveUser(u1.Id);
        }
        }catch(Exception e){
            
        }   
        Test.stopTest();
        
    }
}