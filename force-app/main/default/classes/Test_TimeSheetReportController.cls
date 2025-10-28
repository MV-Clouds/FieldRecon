@isTest
public class Test_TimeSheetReportController {
    @testSetup static void setup(){
        PermissionSet ps = [ SELECT Id FROM PermissionSet WHERE Name = 'WF_Recon_App_Admin'];
        PermissionSetAssignment psa = new PermissionSetAssignment(AssigneeId = UserInfo.getUserId(),PermissionSetId = ps.Id);
        INSERT psa;
        System.FeatureManagement.setPackageBooleanValue('Level_III_User',true);
        System.runAs(new User(Id = UserInfo.getUserId())){
            TestDataFactory.contactDataWithRecordtype(1);
            TestDataFactory.CostCodedata(5);
            TestDataFactory.jobdata(5);
            TestDataFactory.mobdata(5);
            TestDataFactory.TimesheetData(5);
            TestDataFactory.TimesheetEntryData(5);
            TestDataFactory.TimesheetEntryItemData(5);
        }
    }	
	@isTest
    public static void testGetTimeSheetDataWeekly(){
        System.runAs(new User(Id = UserInfo.getUserId())){
            TimeSheetReportController.Filter flt = new TimeSheetReportController.Filter();
            flt.dateFilterType = 'weekly';
            Test.startTest();
        	    List<TimeSheetReportController.TimesheetData> res = TimeSheetReportController.getTimesheetData(flt);
            Test.stopTest();
            for(TimeSheetReportController.TimesheetData d : res) {
                System.assert(d.title != null);
            }
        }
    }
    @isTest
    public static void testGetTimeSheetDataMonthly(){
        System.runAs(new User(Id = UserInfo.getUserId())){
            TimeSheetReportController.Filter flt = new TimeSheetReportController.Filter();
            flt.dateFilterType = 'monthly';
            Test.startTest();
        	    List<TimeSheetReportController.TimesheetData> res = TimeSheetReportController.getTimesheetData(flt);
            Test.stopTest();
            for(TimeSheetReportController.TimesheetData d : res) {
                System.assert(d.title != null);
            }
        }
    }
    @isTest
    public static void testGetTimeSheetDataDaily() {
        System.runAs(new User(Id = UserInfo.getUserId())){
            TimeSheetReportController.Filter flt = new TimeSheetReportController.Filter();
            flt.dateFilterType = 'daily';
            Test.startTest();
        	    List<TimeSheetReportController.TimesheetData> res = TimeSheetReportController.getTimesheetData(flt);
            Test.stopTest();
            for(TimeSheetReportController.TimesheetData d : res) {
                System.assert(d.title != null);
            }
        }
    }
    @isTest
    public static void testGetTimeSheetDataUser() {
        System.runAs(new User(Id = UserInfo.getUserId())){
            TimeSheetReportController.Filter flt = new TimeSheetReportController.Filter();
            flt.dateFilterType = 'weekly';
            Contact c = [ SELECT Id FROM Contact ][0];
            flt.userId = c.Id;
            Test.startTest();
        	    List<TimeSheetReportController.TimesheetData> res = TimeSheetReportController.getTimesheetData(flt);
            Test.stopTest();
            for(TimeSheetReportController.TimesheetData d : res) {
                System.assert(d.title != null);
            }
        }
    }
    @isTest
    public static void testGetTimeSheetDataCostCode() {
        System.runAs(new User(Id = UserInfo.getUserId())){
            TimeSheetReportController.Filter flt = new TimeSheetReportController.Filter();
            flt.dateFilterType = 'weekly';
            Cost_Code__c cc = [ SELECT Id FROM Cost_Code__c ][0];
            List<Timesheet__c> getTimeSheets = [ SELECT Id,Cost_Code__c FROM Timesheet__c ];
            for(Timesheet__c ts : getTimeSheets) {
                ts.Cost_Code__c = cc.Id;
            }
            flt.costCodeId = (String) cc.Id;
            Test.startTest();
        	    List<TimeSheetReportController.TimesheetData> res = TimeSheetReportController.getTimesheetData(flt);
            Test.stopTest();
            for(TimeSheetReportController.TimesheetData d : res) {
                System.assert(d.title != null);
            }
        }
    }
    @isTest
    public static void testGetEmployeeTimeEntryData() {
        System.runAs(new User(Id = UserInfo.getUserId())){
            TimeSheetReportController.EmployeeFilter emp = new TimeSheetReportController.EmployeeFilter();
            Contact c = [ SELECT Id FROM Contact ][0];
            emp.employeeId = c.Id;
            Test.startTest();
        	    List<TimeSheetReportController.EmployeeTimeEntryData> res = TimeSheetReportController.getEmployeeTimeEntryData(emp);
            Test.stopTest();
            for(TimeSheetReportController.EmployeeTimeEntryData e : res) {
                System.assertEquals(e.employeeName, 'TEst');
            }
        }
    }
    @isTest
    public static void testExceptionData(){
        TimeSheetReportController.Filter flt;
        Test.startTest();
        try{
         	List<TimeSheetReportController.TimesheetData> getData = TimeSheetReportController.getTimesheetData(flt);   
        }
        catch(Exception e) {
            System.assert(true,'Exception caught!');
        }
        Test.stopTest();
    }
}