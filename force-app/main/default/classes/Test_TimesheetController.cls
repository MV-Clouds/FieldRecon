@isTest
public class Test_TimesheetController {
    @isTest
    public static void test() {
        // User u = TestDataFactory.createAdminUser();

        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            Contact contact = new Contact(
                LastName = 'Test',
                FirstName = 'Name',
                User__c = TestDataFactory.userList[0].Id
            );
            insert contact;
            TestDataFactory.currentUserContact = contact;
            TestDataFactory.createAccountData(5);
            TestDataFactory.jobdata(5);
            TestDataFactory.contactData(5);
            TestDataFactory.AssetData(5);
            TestDataFactory.mobdata(5);
            TestDataFactory.MobAssetData(5);
            TestDataFactory.memberData(5, contact.Id);
            TestDataFactory.TimesheetData(5);
            TestDataFactory.TimesheetEntryData(5);
            TestDataFactory.ExpenseData(5);

            Date dt = System.today();
            System.assert(TestDataFactory.TimesheetList[0].Id != null, 'msg');
            TimesheetController.getTimeData(dt);
        }
    }

    @isTest
    public static void testGetWeekTimeData() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            Contact contact = new Contact(
                LastName = 'Test',
                FirstName = 'Name',
                User__c = TestDataFactory.userList[0].Id
            );
            insert contact;
            TestDataFactory.currentUserContact = contact;
            TestDataFactory.createAccountData(5);
            TestDataFactory.jobdata(5);
            TestDataFactory.contactData(5);
            TestDataFactory.AssetData(5);
            TestDataFactory.mobdata(5);
            TestDataFactory.MobAssetData(5);
            TestDataFactory.memberData(5, contact.Id);
            TestDataFactory.TimesheetData(7);
            TestDataFactory.TimesheetEntryData(7);
            List<Timesheet_Entry__c> testList = [SELECT Id, Entry_Date__c FROM Timesheet_Entry__c];
            for (Integer i = 0; i < testList.size(); i++) {
                testList[i].Entry_Date__c = testList[i].Entry_Date__c.addDays(i);
            }
            update testList;
            TestDataFactory.ExpenseData(5);
            TestDataFactory.createPostalCode(5);
            TestDataFactory.CostCodedata(5);
            TestDataFactory.TimesheetEntryItemData(7);
            Test.startTest();
            TimesheetController.timeSheetTotal testResult = TimesheetController.getWeekTimeData(System.today());
            Test.stopTest();
            System.assertEquals(120.00, testResult.Day1);
        }
    }
}