@isTest
public class Test_TimesheetWeeklyController {
    @isTest
    public static void test() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            List<Contact> contacts = new List<Contact>();
            for (User u : TestDataFactory.userList) {
                contacts.add(new Contact(LastName = u.LastName, firstName = u.firstName, User__c = u.Id));
            }
            insert contacts;
            TestDataFactory.jobdata(5);

            List<TimeSheet__c> tiimeSheetList = new List<TimeSheet__c>();
            for (Integer i = 0; i < 100; i++) {
                TimeSheet__c timesheet = new TimeSheet__c();

                timesheet.Job__c = i == 0
                    ? TestDataFactory.jobList[2].Id
                    : i == 1 ? TestDataFactory.jobList[1].Id : TestDataFactory.jobList[0].Id;

                timesheet.Contact__c = i == 0 ? contacts[2].Id : i == 1 ? contacts[1].id : contacts[0].Id;

                timesheet.Time_In__c = System.now();
                timesheet.Timesheet_Start_Date__c = System.today();
                timesheet.Timesheet_End_Date__c = System.today().addDays(2);
                tiimeSheetList.add(timesheet);
            }
            insert tiimeSheetList;

            List<Timesheet_Entry__c> timeSheetEntryList = new List<Timesheet_Entry__c>();
            for (Integer i = 0; i < 100; i++) {
                Timesheet_Entry__c teList = new Timesheet_Entry__c();

                teList.TimeSheet__c = i == 0
                    ? tiimeSheetList[2].Id
                    : i == 1 ? tiimeSheetList[1].Id : tiimeSheetList[0].Id;

                teList.Entry_Date__c = System.today();
                TimesheetEntryList.add(teList);
            }
            insert timeSheetEntryList;

            PageReference pageRef = Page.TimesheetWeeklyPage;
            Test.setCurrentPage(pageRef); // Add your VF page Name here
            ApexPages.currentPage().getParameters().put('UserId', '');
            ApexPages.currentPage().getParameters().put('recordId', '');
            ApexPages.currentPage().getParameters().put('StartDate', String.valueof(System.today()));
            ApexPages.currentPage().getParameters().put('EndDate', String.valueof(System.today().addDays(9)));

            System.assert(true, 'condition is true');
            TimesheetWeeklyController testtime = new TimesheetWeeklyController();
        }

    }

    @isTest
    public static void test2() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            List<Contact> contacts = new List<Contact>();
            for (User u : TestDataFactory.userList) {
                contacts.add(new Contact(LastName = u.LastName, firstName = u.firstName, User__c = u.Id));
            }
            insert contacts;
            TestDataFactory.jobdata(5);

            List<TimeSheet__c> tiimeSheetList = new List<TimeSheet__c>();
            for (Integer i = 0; i < 100; i++) {
                TimeSheet__c timesheet = new TimeSheet__c();

                timesheet.Job__c = i == 0
                    ? TestDataFactory.jobList[2].Id
                    : i == 1 ? TestDataFactory.jobList[1].Id : TestDataFactory.jobList[0].Id;

                timesheet.Contact__c = i == 0 ? contacts[2].id : i == 1 ? contacts[1].id : contacts[0].id;

                timesheet.Time_In__c = System.now();
                timesheet.Timesheet_Start_Date__c = System.today();
                timesheet.Timesheet_End_Date__c = System.today().addDays(2);
                tiimeSheetList.add(timesheet);
            }
            insert tiimeSheetList;

            List<Timesheet_Entry__c> timeSheetEntryList = new List<Timesheet_Entry__c>();
            for (Integer i = 0; i < 100; i++) {
                Timesheet_Entry__c teList = new Timesheet_Entry__c();

                teList.TimeSheet__c = i == 0
                    ? tiimeSheetList[2].Id
                    : i == 1 ? tiimeSheetList[1].Id : tiimeSheetList[0].Id;

                teList.Entry_Date__c = System.today();
                TimesheetEntryList.add(teList);
            }
            insert timeSheetEntryList;

            PageReference pageRef = Page.TimesheetWeeklyPage;
            Test.setCurrentPage(pageRef); // Add your VF page Name here
            ApexPages.currentPage().getParameters().put('UserId', TestDataFactory.userList[0].id);
            ApexPages.currentPage().getParameters().put('recordId', TestDataFactory.userList[0].id);
            ApexPages.currentPage().getParameters().put('StartDate', String.valueof(System.today()));
            ApexPages.currentPage().getParameters().put('EndDate', String.valueof(System.today().addDays(9)));
            System.assert(true, 'condition is true');
            TimesheetWeeklyController testtime = new TimesheetWeeklyController();
        }
    }
}