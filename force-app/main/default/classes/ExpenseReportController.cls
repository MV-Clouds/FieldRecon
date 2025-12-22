/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 06-17-2021
 * @last modified by  : Ashita Kothari
 * Modifications Log 
 * Ver   Date         Author                               Modification
 * 1.0   04-06-2021   ChangeMeIn@UserSettingsUnder.SFDoc   Initial Version
**/
public with sharing class ExpenseReportController {

    @AuraEnabled
    public static List<ExpenseData> getExpenseData(Object flts){
        Filter flt=(Filter)JSON.deserialize(JSON.serialize(flts),Filter.class);
        try {
            if(flt == null) {
                throw new AuraHandledException('Filter cannot be null');
            }
            return getExpenseDataList(flt); 
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ExpenseReportController', 'methodName' => 'getExpenseData', 'exceptionObj' => e});
            return null;
        }
    }
    @AuraEnabled
    public static Map<String,Object> updateExpenseData(Object exps) {
        ExpenseStatus exp=(ExpenseStatus)JSON.deserialize(JSON.serialize(exps),ExpenseStatus.class);
        Map<String,Object> results = new Map<String,Object>();
        Object[] arguments = new Object[]{exp.expenseId, exp.statusOfRecord};
        List<Expense__c> expensesToUpdate = Lib_Security.ws().dbQuery(getUpdateQuery(exp.expenseId,exp.statusOfRecord), arguments);
        for(Expense__c e : expensesToUpdate) {
            e.Status__c = exp.statusOfRecord;
        }
        List<Database.SaveResult> updatedExpenses = Lib_Security.ws().dbUpdate(expensesToUpdate);
        for(Database.SaveResult res : updatedExpenses){
            if(!res.success) {
                results.put('message', res.getErrors());
                results.put('Status', 'error');
                break;
            }
            else {
                results.put('Status', 'success');    
            }
        }
        System.debug(updatedExpenses);
        return results;

    }
    public static String getUpdateQuery(Id expenseId,String status) {
        String query = 
            'SELECT '+
                'Id, '+
                'Status__c '+
                'FROM Expense__c WHERE Id = :arg1';
        return query; 
    }
    // Format date in MMMDDYYYY format
    private static String formatDate(Date d) {
        return getMonthName(d) + ' ' + d.day() + ', ' + d.year();
    }
    private static String getMonthName(Date d) {
        if(d != null) {
            Datetime dt = d;
            return dt.format('MMM');
        }
        return null;
    }
    private static String formatDate(Date d, String format) {
        if(d != null) {
            Datetime dt = d;
            return dt.format(format);
        }
        return null;
    }
    public static List<ExpenseData> getExpenseDataList(Filter flt) {
        List<ExpenseData> expenseDataList = new List<ExpenseData>();
        Object[] arguments = new Object[]{flt.userId, flt.startDate, flt.endDate, flt.billablityStatus};
        Map<String, List<ExpenseDataItem>> groupedTimesheets = new Map<String, List<ExpenseDataItem>>();
        List<Expense__c> expenseSheets =  Lib_Security.ws().dbQuery(getExpenseQuery(flt), arguments);
        if(flt.dateFilterType == 'weekly') {
            //List<Expense> expenseSheets =  Lib_Security.ws().dbQuery(getWeeklyTimesheetQuery(flt), arguments);
            groupedTimesheets = groupExpensesByWeek(expenseSheets);
        }
        else if(flt.dateFilterType == 'daily' || flt.dateFilterType == 'custom') {
            groupedTimesheets = groupExpensesByDay(expenseSheets);
        } else if(flt.dateFilterType == 'monthly') {
            groupedTimesheets = groupExpensesByMonth(expenseSheets);
        }
        for(String key: groupedTimesheets.keySet()) {
            //Decimal totalAmountExp = getTotalAmountForTime(groupedTimesheets.get(key));
            ExpenseData expenseData = new ExpenseData(key, groupedTimesheets.get(key));
            expenseDataList.add(expenseData);
        }
        System.debug(expenseDataList);
        return expenseDataList;
    }
    private static Map<String, List<ExpenseDataItem>> groupExpensesByWeek(List<Expense__c> expenseSheet){
        Map<String, List<ExpenseDataItem>> groupedExpenseSheet = new Map<String, List<ExpenseDataItem>>();
        for(Expense__c exp : expenseSheet) {
            Date startOfWeek = exp.Transaction_Date__c.date().toStartOfWeek();
            Date endOfWeek = startOfWeek.addDays(7);
            String key = formatDate(startOfWeek) + ' - ' + formatDate(endOfWeek);
            List<ExpenseDataItem> weekSheet = new List<ExpenseDataItem>();
            if(groupedExpenseSheet.get(key) == null) {
                weekSheet.add(createExpenseDataItem(exp));
            }
            else {
                weekSheet = groupedExpenseSheet.get(key);
                weekSheet.add(createExpenseDataItem(exp));
            }
            groupedExpenseSheet.put(key, weekSheet);
        }
        return groupedExpenseSheet;
    }
    private static Map<String, List<ExpenseDataItem>> groupExpensesByMonth(List<Expense__c> expenseSheet) {
        Map<String, List<ExpenseDataItem>> groupedExpenseSheet = new Map<String, List<ExpenseDataItem>>();
        List<Id> expensesId = new List<Id>();
        for(Expense__c exp : expenseSheet) {
            expensesId.add(exp.Id);
            Date startOfWeek = exp.Transaction_Date__c.date().toStartOfMonth();
            Date endOfWeek = startOfWeek.addMonths(1).addDays(-1);
            String key = formatDate(startOfWeek) + ' - ' + formatDate(endOfWeek);
            List<ExpenseDataItem> monthSheet = new List<ExpenseDataItem>();
            if(groupedExpenseSheet.get(key) == null) {
                monthSheet.add(createExpenseDataItem(exp));
            }
            else {
                monthSheet = groupedExpenseSheet.get(key);
                monthSheet.add(createExpenseDataItem(exp));
            }
            groupedExpenseSheet.put(key, monthSheet);
        }
        return groupedExpenseSheet;
    }
    private static Map<String, List<ExpenseDataItem>> groupExpensesByDay(List<Expense__c> expenseSheet) {
        Map<String, List<ExpenseDataItem>> groupedExpenseSheet = new Map<String, List<ExpenseDataItem>>();
        for(Expense__c exp : expenseSheet) {
            String key = formatDate(exp.Transaction_Date__c.date())+ ' - ' + formatDate(exp.Transaction_Date__c.date(), 'EEEE');
            List<ExpenseDataItem> dailySheet = new List<ExpenseDataItem>();
            if(groupedExpenseSheet.get(key) == null) {
                dailySheet.add(createExpenseDataItem(exp));
            }
            else {
                dailySheet = groupedExpenseSheet.get(key);
                dailySheet.add(createExpenseDataItem(exp));
            }
            groupedExpenseSheet.put(key, dailySheet);
        }
        return groupedExpenseSheet;
    }
    private static String getExpenseQuery(Filter flt) {
        String query = 
            'SELECT '+
                'Id, '+
                'Contact__c, Contact__r.Name, ' +
                'Job__c, Job__r.Job_Name__c,Job__r.Name, ' + 
                'Expense_Type__c, ' +
                'Transaction_Date__c, ' +
                'Status__c, '+ 
                'Amount__c '+
                'FROM Expense__c WHERE Contact__r.RecordType.DeveloperName = \'Employee_WF_Recon\' AND Contact__r.User__c != null';
                Boolean hasCustomStartEndDateFilter = flt.dateFilterType == 'custom' && flt.startDate != null && flt.endDate != null;
                if(String.isNotBlank(flt.userId)) {
                    query += ' AND Contact__c = :arg1';
                }
                if(String.isNotBlank(flt.billablityStatus)) {
                    query += ' AND Expense_Type__c = :arg4';
                }
                if(hasCustomStartEndDateFilter) {
                    query += ' AND Transaction_Date__c >= :arg2 AND Transaction_Date__c <= :arg3';
                }
                query += ' ORDER BY Transaction_Date__c DESC';
                return query;
    }
    private static ExpenseDataItem createExpenseDataItem(Expense__c exp) {
        return new ExpenseDataItem()
        .setId(exp.Id)
        .setMember(exp.Contact__r?.Name, '/' + exp?.Contact__c)
        .setJob(exp.Job__r?.Job_Name__c, '/' + exp?.Job__c,exp.Job__r.Name)
        .setExpense(exp.Expense_Type__c)
        .setAmount(exp.Amount__c)
        .setStatus(exp.Status__c);
    }
    public class Filter {
        @AuraEnabled
        public String dateFilterType {get; set;}
        @AuraEnabled
        public Date startDate {get; set;}
        @AuraEnabled
        public Date endDate {get; set;}
        @AuraEnabled
        public String userId {get; set;}
        @AuraEnabled
        public String billablityStatus {get; set;}

        public Filter() {}
    }
    public class ExpenseStatus{
        @AuraEnabled
        public Id expenseId {get; set;}
        @AuraEnabled
        public String statusOfRecord {get; set;}
    }
    public class ExpenseData {
        @AuraEnabled
        public String title;
        @AuraEnabled
        public List<ExpenseDataItem> data;

        public ExpenseData(String title, List<ExpenseDataItem> data) {
            this.title = title;
            this.data = data;
        }
    }
    public class ExpenseDataItem{
        @AuraEnabled
        public Id id;
        @AuraEnabled
        public String memberName;
        @AuraEnabled
        public String memberLink;
        @AuraEnabled
        public String jobName;
        @AuraEnabled
        public String jobLink;
        @AuraEnabled
        public String expenseType;
        @AuraEnabled
        public Decimal amount;
        @AuraEnabled
        public String status;
        public ExpenseDataItem setId(Id idOfExpense) {
            this.id = idOfExpense;
            return this;
        }
        public ExpenseDataItem setMember(String memberName, String memberLink) {
            this.memberName = memberName;
            this.memberLink = memberLink;
            return this;
        }
        public ExpenseDataItem setJob(String jobName, String jobLink,String jobAutoName) {
            this.jobName = jobName == NULL || jobName == ''? jobAutoName : jobName;
            this.jobLink = jobLink;
            return this;
        }
        public ExpenseDataItem setExpense(String type) {
            this.expenseType = type;
            return this;
        }
        public ExpenseDataItem setAmount(Decimal a) {
            this.amount = a;
            return this;
        }
        public ExpenseDataItem setStatus(String s) {
            this.status = s;
            return this;
        }
    }
}