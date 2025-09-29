@isTest
public class Test_UpdateTimesheetBatch {
    @isTest
    public static void timesheetMethod1() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            Job__c j = new Job__c();
            j.Job_Name__c = 'test job';
            insert j;

            Date myDate = Date.newInstance(2019, 12, 20);

            List<Timesheet__c> lstTs = new List<Timesheet__c>();
            Timesheet__c ts = new Timesheet__c();
            ts.Job__c = j.Id;
            ts.Time_In__c = System.today();
            ts.Timesheet_Start_Date__c = System.today();
            ts.Timesheet_End_Date__c = System.today() - 14;
            insert ts;

            Test.startTest();

            System.assert(ts.Id != null, 'timesheet is not null');
            UpdateTimesheetBatch utb = new UpdateTimesheetBatch();
            DataBase.executeBatch(utb);
            Test.stopTest();
        }
    }

    @isTest
    public static void timesheetMethod2() {
        Test.startTest();
        TestDataFactory.UserData();
        Test.stopTest();
        System.runAs(TestDataFactory.userList[0]) {
            Job__c j = new Job__c();
            j.Job_Name__c = 'test jobq';
            insert j;

            Date myDate = Date.newInstance(2019, 12, 25);

            List<Timesheet__c> lstTs = new List<Timesheet__c>();
            Timesheet__c ts = new Timesheet__c();
            ts.Job__c = j.Id;
            ts.Time_In__c = myDate;
            ts.Time_Out__c = null;
            ts.Time_Out_Geolocation__latitude__s = null;
            ts.Time_Out_Geolocation__longitude__s = null;
            insert ts;

            Map<Id, Timesheet_Entry__c> mapTse = new Map<Id, Timesheet_Entry__c>();
            Timesheet_Entry__c te = new Timesheet_Entry__c();
            te.TimeSheet__c = ts.Id;
            te.Entry_Date__c = system.today() - 1;
            insert te;
            mapTse.put(te.Id, te);

            System.assert(ts.Id != null, 'timesheet is not null');
            UpdateTimesheet sh1 = new UpdateTimesheet();
            String sch = '0 0 2 * * ?';
            system.schedule('Test Update Timesheet', sch, sh1);
        }
    }
}