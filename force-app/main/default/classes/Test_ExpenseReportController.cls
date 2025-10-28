@isTest
public class Test_ExpenseReportController {
    @testSetup static void setup(){
        PermissionSet ps = [ SELECT Id FROM PermissionSet WHERE Name = 'WF_Recon_App_Admin'];
        PermissionSetAssignment psa = new PermissionSetAssignment(AssigneeId = UserInfo.getUserId(),PermissionSetId = ps.Id);
        INSERT psa;
        System.runAs(new User(Id = UserInfo.getUserId())){
            TestDataFactory.contactDataWithRecordtype(1);
            TestDataFactory.CostCodedata(5);
            TestDataFactory.jobdata(5);
            TestDataFactory.mobdata(5);
            TestDataFactory.ExpenseData(5);
            Contact c = [ SELECT Id FROM Contact ][0];
            for(Expense__c e : TestDataFactory.ExpenseList){
                e.Contact__c = c.Id;
            }
            update TestDataFactory.ExpenseList;
        }
    }
    @isTest
    public static void testGetExpenseDataWeekly(){
        System.runAs(new User(Id = UserInfo.getUserId())){
            ExpenseReportController.Filter flt = new ExpenseReportController.Filter();
            flt.dateFilterType = 'weekly';
            Test.startTest();
        	    List<ExpenseReportController.ExpenseData> res = ExpenseReportController.getExpenseData(flt);
            Test.stopTest();
            for(ExpenseReportController.ExpenseData d : res) {
                System.assert(d.title != null);
            }
        }    
    }
    @isTest
    public static void testGetExpenseDataMonthly(){
        System.runAs(new User(Id = UserInfo.getUserId())){
            ExpenseReportController.Filter flt = new ExpenseReportController.Filter();
            flt.dateFilterType = 'monthly';
            Test.startTest();
        	    List<ExpenseReportController.ExpenseData> res = ExpenseReportController.getExpenseData(flt);
            Test.stopTest();
            for(ExpenseReportController.ExpenseData d : res) {
                System.assert(d.title != null);
            }    
        }
    }
    @isTest
    public static void testGetExpenseDataDaily(){
        System.runAs(new User(Id = UserInfo.getUserId())){
            ExpenseReportController.Filter flt = new ExpenseReportController.Filter();
            flt.dateFilterType = 'daily';
            Test.startTest();
        	    List<ExpenseReportController.ExpenseData> res = ExpenseReportController.getExpenseData(flt);
            Test.stopTest();
            for(ExpenseReportController.ExpenseData d : res) {
                System.assert(d.title != null);
            }  
        }  
    }
    @isTest
    public static void testUpdateExpense() {
        System.runAs(new User(Id = UserInfo.getUserId())){
            ExpenseReportController.ExpenseStatus exp = new ExpenseReportController.ExpenseStatus();
            Expense__c getExpenses = [ SELECT Id,Status__c FROM Expense__c ][0];
            exp.expenseId = getExpenses.Id;
            exp.statusOfRecord = 'Approved';
            Test.startTest();
        	    Map<String,Object> res = ExpenseReportController.updateExpenseData(exp);
            Test.stopTest();
            System.assert(res.size() > 0);
        }
    }
}