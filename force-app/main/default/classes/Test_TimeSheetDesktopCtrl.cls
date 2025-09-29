@isTest
public class Test_TimeSheetDesktopCtrl {
    @TestSetup
    static void makeData(){
        System.FeatureManagement.setPackageBooleanValue('Level_III_User',true);
    }
    @isTest
    public static void test() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            List<Timesheet_Entry__c> TimesheetEntryList = new List<Timesheet_Entry__c>();
            Contact contact = new Contact(LastName = 'Test', FirstName = 'Name', User__c = UserInfo.getUserId());
            insert contact;
            TestDataFactory.currentUserContact = contact;
            TestDataFactory.jobdata(5);
            TestDataFactory.createAccountData(5);
            TestDataFactory.contactData(5);
            TestDataFactory.TimesheetData(5);
            Id tsId = TestDataFactory.TimesheetList[0].Id;
            for (Integer i = 0; i < 10; i++) {
                Timesheet_Entry__c timesheetentry = new Timesheet_Entry__c();

                timesheetentry.TimeSheet__c = tsId;
                timesheetentry.Entry_Date__c = System.today().addDays(i);
                TimesheetEntryList.add(timesheetentry);
            }
            insert TimesheetEntryList;

            TestDataFactory.TimesheetEntryData(5);

            System.assert(TestDataFactory.userList[1].Id != null, 'Pass');
            TimeSheetDesktopCtrl.getDefaultUserId();
            TimeSheetDesktopCtrl.getTimesheetDatas(System.today(), TestDataFactory.jobList[0].Id);
            TimeSheetDesktopCtrl.getTimesheetDatas(System.today().addDays(1), TestDataFactory.userList[0].Id);
        }
    }

    @isTest
    public static void test1() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            List<Timesheet_Entry__c> TimesheetEntryList = new List<Timesheet_Entry__c>();
            TestDataFactory.jobdata(10);
            List<Contact> contacts = new List<Contact>();
            for (User u : TestDataFactory.userList) {
                contacts.add(new Contact(LastName = u.LastName, firstName = u.firstName, User__c = u.Id));
            }
            insert contacts;

            List<TimeSheet__c> TimesheetList = new List<TimeSheet__c>();
            for (Integer i = 0; i < 10; i++) {
                TimeSheet__c timesheet = new TimeSheet__c();
                timesheet.Job__c = TestDataFactory.jobList[i].id;
                timesheet.Contact__c = contacts[i].Id;
                timesheet.Timesheet_Start_Date__c = System.today();
                timesheet.Timesheet_End_Date__c = System.today().addDays(12);
                TimesheetList.add(timesheet);
            }
            insert TimesheetList;

            for (Integer i = 0; i < 10; i++) {
                Timesheet_Entry__c timesheetentry = new Timesheet_Entry__c();
                timesheetentry.TimeSheet__c = TimesheetList[i].Id;
                timesheetentry.Entry_Date__c = System.today().addDays(i);
                TimesheetEntryList.add(timesheetentry);
            }
            insert TimesheetEntryList;
            System.assert(TestDataFactory.userList[1].Id != null, 'Pass');
            TimeSheetDesktopCtrl.getDefaultUserId();
            TimeSheetDesktopCtrl.getTimesheetDatas(System.today().addDays(1), TestDataFactory.userList[1].Id);
            TimeSheetDesktopCtrl.getTimesheetDatas(System.today().addDays(1), TestDataFactory.userList[2].Id);
            TimeSheetDesktopCtrl.getTimesheetDatas(System.today().addDays(1), TestDataFactory.userList[3].Id);
            TimeSheetDesktopCtrl.getTimesheetDatas(System.today().addDays(1), TestDataFactory.userList[4].Id);
            TimeSheetDesktopCtrl.getTimesheetDatas(System.today().addDays(1), TestDataFactory.userList[5].Id);
            TimeSheetDesktopCtrl.getTimesheetDatas(System.today().addDays(1), TestDataFactory.userList[6].Id);
            TimeSheetDesktopCtrl.getTimesheetDatas(System.today().addDays(1), TestDataFactory.userList[7].Id);
        }
    }
}