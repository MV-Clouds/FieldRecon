@isTest
public class Test_JobTeamMembersController {
    public static List<TimeSheet__c> TimesheetList2 { get; set; }

    @TestSetup
    static void makeData(){
        System.FeatureManagement.setPackageBooleanValue('Level_III_User',true);
    }

    @isTest
    public static void jobCreate() {
        List<User> userList2 = new List<User>();
        Profile pf2 = [SELECT Id FROM Profile WHERE Name = 'System Administrator'];
        User u2 = new User();
        u2.FirstName = 'testnew';
        u2.LastName = 'testnew';
        u2.email = 'chiragnew@gmail.com';
        u2.Username = 'chiragrainew@gmail.com';
        u2.Alias = 'testnew';
        u2.Phone = '1234567898';
        u2.TimeZoneSidKey = 'America/Los_Angeles';
        u2.EmailEncodingKey = 'UTF-8';
        u2.LanguageLocaleKey = 'en_US';
        u2.LocaleSidKey = 'en_US';
        u2.ProfileId = pf2.Id;
        u2.IsActive = true;

        userList2.add(u2);
        insert userList2;
        Id subContractRecordTypeId = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName()
                      .get('Sub_Contractor_WF_Recon').getRecordTypeId();
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            Contact contact = new Contact(
                LastName = 'Test',
                FirstName = 'Name',
                Can_Log_In_Out__c = TRUE,
                RecordTypeId = subContractRecordTypeId
            );
            insert contact;
            TestDataFactory.jobdata(10);
            TestDataFactory.mobdata(10);

            List<Mobilization_Member__c> memberList = new List<Mobilization_Member__c>();
            for (Integer i = 0; i < 10; i++) {
                Mobilization_Member__c mem = new Mobilization_Member__c();
                mem.Contact__c = contact.Id;
                mem.Mobilization__c = TestDataFactory.mobList[i].Id;
                memberList.add(mem);
            }
            insert memberList;

            List<TimeSheet__c> TimesheetList = new List<TimeSheet__c>();
            for (Integer i = 0; i < 10; i++) {
                TimeSheet__c timesheet = new TimeSheet__c();
                timesheet.Job__c = TestDataFactory.jobList[i].Id;
                timesheet.Contact__c = contact.id;
                timesheet.Time_In__c = System.now();
                timesheet.Timesheet_Start_Date__c = System.today();
                timesheet.Timesheet_End_Date__c = System.today().addDays(2);
                TimesheetList.add(timesheet);
            }
            insert TimesheetList;
            System.assert(TestDataFactory.jobList[0].Id != null, 'jobId is not null');
            JobTeamMembersController.getJobTeamMembers(TestDataFactory.jobList[0].Id);
        }

    }
}