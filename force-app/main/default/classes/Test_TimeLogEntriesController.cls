@isTest
public class Test_TimeLogEntriesController {
    @isTest
    public static void test() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            Contact contact = new Contact(LastName = 'Test', FirstName = 'Name', User__c = UserInfo.getUserId());
            insert contact;
            TestDataFactory.currentUserContact = contact;
            TestDataFactory.jobData(5);
            TestDataFactory.createPostalCode(5);
            TestDataFactory.CostCodedata(5);
            TestDataFactory.createAccountData(5);
            TestDataFactory.contactData(5);
            TestDataFactory.TimesheetData(5);
            TestDataFactory.TimesheetEntryData(5);
            TestDataFactory.TimesheetEntryItemData(5);

            Test.startTest();
            System.assert(TestDataFactory.jobList[0].Id != null, 'jobId is  null');
            TimeLogEntriesController.getLogEntries(
                TestDataFactory.jobList[0].Id,
                UserInfo.getUserId(),
                'timesheet',
                System.today(),
                System.today(),
                System.today(),
                System.today().addDays(15),
                '110',
                '1',
                '1'
            );

            TimeLogEntriesController.getLogEntries(
                TestDataFactory.jobList[0].Id,
                UserInfo.getUserId(),
                'timesheetentries',
                System.today(),
                System.today(),
                System.today().addDays(2),
                System.today().addDays(5),
                '10',
                '1',
                '1'
            );

            TimeLogEntriesController.getLogEntries(
                TestDataFactory.jobList[0].Id,
                UserInfo.getUserId(),
                'timesheetitmes',
                System.today(),
                System.today(),
                System.today().addDays(5),
                System.today().addDays(5),
                '104',
                '1',
                '1'
            );

            Test.stopTest();
        }
    }
}