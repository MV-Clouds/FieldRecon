public with sharing class TimesheetController {
    public static Id UserId = UserInfo.getUserId();
    @AuraEnabled
    public static List<TimesheetEntryItem> getTimeData(Date getDate) {
        list<Mobilization__c> lstFM = new List<Mobilization__c>();
        String query = Util.getQueryData(
            'Mobilization__c',
            ' , (SELECT Name, Date_on_Site__c, Contact__c, Contact__r.User__c FROM ' +
            ' Mobilization_Members__r WHERE  Contact__r.User__c =:arg1) , ' +
            ' (SELECT Id, Name, Active__c, Equipment__c FROM Mobilization_Assets__r)'
        );
        
        query += ' a WHERE a.Id IN (SELECT Mobilization__c FROM   Mobilization_Member__c WHERE  Contact__r.User__c =:arg2) WITH SECURITY_ENFORCED';
        
        Set<Id> jobIds = new Set<Id>();
        
        for (Mobilization__c mob : (Mobilization__c[])Lib_Security.ws().dbQuery(query, new Object[]{UserId,UserId})) {
            jobIds.add(mob.Job__c);
        }
        
        list<Timesheet_Entry_Item__c> lstTime = new List<Timesheet_Entry_Item__c>();
        
        
        String soql = 'SELECT Id,Name,Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,'+
            'Timesheet_Entry__r.TimeSheet__r.Job__r.Name,Timesheet_Entry__r.TimeSheet__r.Name,'+
            'Total_Time__c,Clock_In_Time__c,Clock_Out_Time__c,createdDate FROM Timesheet_Entry_Item__c'+
            ' WHERE Timesheet_Entry__r.Timesheet__r.Job__c IN :arg1'+
            ' AND Timesheet_Entry__r.Entry_Date__c = :arg2'+
            ' AND Timesheet_Entry__r.Timesheet__r.Contact__r.User__c = :arg3'+
            ' WITH SECURITY_ENFORCED ORDER BY Timesheet_Entry__r.Entry_Date__c DESC';
        lstTime    = Lib_Security.ws().dbQuery(soql, new Object[]{jobIds,getDate,UserId});   
        List<TimesheetEntryItem> timeEntryItems = new List<TimesheetEntryItem>();
        for(Timesheet_Entry_Item__c t : lstTime){
            timeEntryItems.add(new TimesheetEntryItem(t));
        }
        return timeEntryItems;
    }
    @AuraEnabled
    public static timeSheetTotal getWeekTimeData(Date StartDate) {
        list<Mobilization__c> lstFM = new List<Mobilization__c>();
        String query = Util.getQueryData(
            'Mobilization__c',
            ' , (SELECT Name, Date_on_Site__c, Contact__c, Contact__r.User__c FROM ' +
            ' Mobilization_Members__r WHERE  Contact__r.User__c =:arg1) , ' +
            ' (SELECT Id, Name, Active__c, Equipment__c FROM Mobilization_Assets__r)'
        );
        
        query += ' a WHERE a.Id IN (SELECT Mobilization__c FROM   Mobilization_Member__c WHERE  Contact__r.User__c =:arg2) WITH SECURITY_ENFORCED';
        
        Set<Id> jobIds = new Set<Id>();
        
        for (Mobilization__c mob : (Mobilization__c[])Lib_Security.ws().dbQuery(query, new Object[]{UserId,UserId})) {
            jobIds.add(mob.Job__c);
        }
        
        list<Timesheet_Entry_Item__c> lstTime = new List<Timesheet_Entry_Item__c>();
        
        String soql = 'SELECT Id,Name,Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,Timesheet_Entry__r.Entry_Date__c,'+
            'Timesheet_Entry__r.TimeSheet__r.Job__r.Name,Timesheet_Entry__r.TimeSheet__r.Name,'+
            'Total_Time__c,Clock_In_Time__c,Clock_Out_Time__c,createdDate FROM Timesheet_Entry_Item__c'+
            ' WHERE Timesheet_Entry__r.Timesheet__r.Job__c IN :arg1'+
            ' AND Timesheet_Entry__r.Entry_Date__c >= :arg2'+
            ' AND Timesheet_Entry__r.Timesheet__r.Contact__r.User__c = :arg3'+
            ' WITH SECURITY_ENFORCED ORDER BY Timesheet_Entry__r.Entry_Date__c DESC';
        lstTime = Lib_Security.ws().dbQuery(soql, new Object[]{jobIds,StartDate,UserId}); 
        timeSheetTotal tst = new timeSheetTotal();
        List<timeSheetTotal> timeSheetWrapperList = new List<timeSheetTotal>();
        
        for (Timesheet_Entry_Item__c tse : lstTime) {
            if (tse.Timesheet_Entry__r.Entry_Date__c == StartDate) {
                tst.Day1 += tse.Total_Time__c;
            } else if (tse.Timesheet_Entry__r.Entry_Date__c == StartDate.addDays(1)) {
                tst.Day2 += tse.Total_Time__c;
            } else if (tse.Timesheet_Entry__r.Entry_Date__c == StartDate.addDays(2)) {
                tst.Day3 += tse.Total_Time__c;
            } else if (tse.Timesheet_Entry__r.Entry_Date__c == StartDate.addDays(3)) {
                tst.Day4 += tse.Total_Time__c;
            } else if (tse.Timesheet_Entry__r.Entry_Date__c == StartDate.addDays(4)) {
                tst.Day5 += tse.Total_Time__c;
            } else if (tse.Timesheet_Entry__r.Entry_Date__c == StartDate.addDays(5)) {
                tst.Day6 += tse.Total_Time__c;
            } else if (tse.Timesheet_Entry__r.Entry_Date__c == StartDate.addDays(6)) {
                tst.Day7 += tse.Total_Time__c;
            }
        }
        
        return tst;
    }
    
    public class timeSheetTotal {
        @AuraEnabled
        public Decimal Day1 = 0;
        @AuraEnabled
        public Decimal Day2 = 0;
        @AuraEnabled
        public Decimal Day3 = 0;
        @AuraEnabled
        public Decimal Day4 = 0;
        @AuraEnabled
        public Decimal Day5 = 0;
        @AuraEnabled
        public Decimal Day6 = 0;
        @AuraEnabled
        public Decimal Day7 = 0;
        @AuraEnabled
        public Decimal Total = 0;
    }
    public class TimesheetEntryItem{
        @AuraEnabled
        public String Id;
        @AuraEnabled
        public DateTime clockIn;
        @AuraEnabled
        public DateTime clockOut;
        @AuraEnabled
        public Double totalTime;
        @AuraEnabled
        public String jobName;
        public TimesheetEntryItem(Timesheet_Entry_Item__c tItem){
            this.Id = tItem?.Id;
            this.clockIn = tItem?.Clock_In_Time__c;
            this.clockOut = tItem?.Clock_Out_Time__c;
            this.jobName = tItem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c;
            this.totalTime = tItem.Total_Time__c;
        }
    }
}