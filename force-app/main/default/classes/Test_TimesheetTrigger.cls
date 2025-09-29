@isTest
public class Test_TimesheetTrigger {
    @isTest
    public static void timesheetMethod1() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
        Test.startTest();
        Job__c j = new Job__c();
        j.Job_Name__c = 'test job';
        insert j;

        Timesheet__c ts = new Timesheet__c();
        ts.Job__c = j.Id;
        ts.Time_In__c = System.now();
        ts.Time_Out__c = System.now();
        ts.Timesheet_Start_Date__c = System.today();
        ts.Timesheet_End_Date__c = System.today();
        insert ts;

        ts.Time_In__c = System.today() + 1;
        ts.Timesheet_Start_Date__c = System.today() + 2;
        ts.Timesheet_End_Date__c = System.today() + 3;
        update ts;

        System.assert(ts.Id != null, 'Timesheet  is not null');
        Test.stopTest();
        }
    }
}