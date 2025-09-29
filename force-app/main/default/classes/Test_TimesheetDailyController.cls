@isTest
public class Test_TimesheetDailyController {
    @isTest
    public static void TimesheetDaily() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            Contact contact = new Contact(
                LastName = 'Test',
                FirstName = 'Name',
                User__c = TestDataFactory.userList[0].Id
            );
            insert contact;
            TestDataFactory.currentUserContact = contact;
            TestDataFactory.jobdata(5);
            TestDataFactory.createAccountData(5);
            TestDataFactory.contactData(5);
            TestDataFactory.TimesheetData(5);

            Default_Values__c abc = new Default_Values__c();
            abc.Name = 'Demo';
            abc.Week_Start_Day__c = 'Monday';
            insert abc;

            TimesheetDailyController.getDefault();
            System.assert(TestDataFactory.jobList[0].Id != null, 'JobId is not null');
            TimesheetDailyController.getTimesheetDetail(
                TestDataFactory.jobList[0].Id,
                System.today(),
                System.today().addDays(7),
                UserInfo.getUserId()
            );
        }
    }
}