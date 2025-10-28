public with sharing class TimeSheetDesktopCtrl {
    @AuraEnabled
    public static User getDefaultUserId() {
        User[] usr = Lib_Security.ws().dbQuery('SELECT Id, Name FROM User WHERE Id = :arg1 LIMIT 1', new Object[]{UserInfo.getUserId()});
        return usr[0];
    }
    
    @AuraEnabled
    public static timeSheetTotal getTimesheetDatas(Date StartDate, Id recordId) {
        try {
            if(!Util.secondLevelFeatureAccess()){
                throw new HandledException('Second Level Feature Not Enabled!');
            }
        } catch (HandledException e) {
            throw new HandledException('Second Level Feature Not Enabled!');
        }
        String selectedObj = String.valueOf(recordId.getsobjecttype());
        Date EndDate = StartDate.addDays(7);
        
        List<Timesheet_Entry__c> timeSheetList = new List<Timesheet_Entry__c>();
        if (selectedObj == Util.getNamespaceWithUnderscore() + 'Job__c') {
            String soql = 'SELECT Id,Entry_Date__c,Total_Clock_In_Time__c,TimeSheet__r.Contact__r.User__c,'+
                'TimeSheet__r.Contact__r.User__r.Name FROM Timesheet_Entry__c '+
                'WHERE Entry_Date__c >= :arg1 AND Entry_Date__c <= :arg2 AND TimeSheet__r.Job__c = :arg3 '+
                'WITH SECURITY_ENFORCED';
            timeSheetList = Lib_Security.ws().dbQuery(soql, new Object[]{StartDate,EndDate,recordId});
            
        } else {
            String soql = 'SELECT Id,Entry_Date__c,Total_Clock_In_Time__c,TimeSheet__r.Contact__r.User__c,'+
                'TimeSheet__r.Contact__r.User__r.Name, TimeSheet__r.Job__c,TimeSheet__r.Job__r.Name FROM Timesheet_Entry__c '+
                'WHERE Entry_Date__c >= :arg1 AND Entry_Date__c <= :arg2 AND TimeSheet__r.Contact__r.User__c = :arg3 '+
                'WITH SECURITY_ENFORCED';
            timeSheetList = Lib_Security.ws().dbQuery(soql, new Object[]{StartDate,EndDate,recordId});
        }
        
        timeSheetTotal tst = new timeSheetTotal();
        List<timeSheet> timeSheetWrapperList = new List<timeSheet>();
        Map<Id, timeSheet> timeSheetMap = new Map<Id, timeSheet>();
        for (Timesheet_Entry__c tse : timeSheetList) {
            Id rId = selectedObj == Util.getNamespaceWithUnderscore() + 'Job__c' ? tse.TimeSheet__r.Contact__r.User__c : tse.TimeSheet__r.Job__c;
            if (!timeSheetMap.containsKey(rId)) {
                timeSheet ts = new timeSheet();
                ts.title = selectedObj == Util.getNamespaceWithUnderscore() + 'Job__c'
                    ? tse.TimeSheet__r.Contact__r.User__r.Name
                    : tse.TimeSheet__r.Job__r.Name;
                if (tse.Entry_Date__c == StartDate) {
                    ts.Day1 = tse.Total_Clock_In_Time__c;
                    tst.Day1 += tse.Total_Clock_In_Time__c;
                } else if (tse.Entry_Date__c == StartDate.addDays(1)) {
                    ts.Day2 = tse.Total_Clock_In_Time__c;
                    tst.Day2 += tse.Total_Clock_In_Time__c;
                } else if (tse.Entry_Date__c == StartDate.addDays(2)) {
                    ts.Day3 = tse.Total_Clock_In_Time__c;
                    tst.Day3 += tse.Total_Clock_In_Time__c;
                } else if (tse.Entry_Date__c == StartDate.addDays(3)) {
                    ts.Day4 = tse.Total_Clock_In_Time__c;
                    tst.Day4 += tse.Total_Clock_In_Time__c;
                } else if (tse.Entry_Date__c == StartDate.addDays(4)) {
                    ts.Day5 = tse.Total_Clock_In_Time__c;
                    tst.Day5 += tse.Total_Clock_In_Time__c;
                } else if (tse.Entry_Date__c == StartDate.addDays(5)) {
                    ts.Day6 = tse.Total_Clock_In_Time__c;
                    tst.Day6 += tse.Total_Clock_In_Time__c;
                } else if (tse.Entry_Date__c == StartDate.addDays(6)) {
                    ts.Day7 = tse.Total_Clock_In_Time__c;
                    tst.Day7 += tse.Total_Clock_In_Time__c;
                }
                ts.Total += tse.Total_Clock_In_Time__c;
                timeSheetMap.put(rId, ts);
            } else {
                timeSheet ts = timeSheetMap.get(rId);
                ts.title = selectedObj == Util.getNamespaceWithUnderscore() + 'Job__c'
                    ? tse.TimeSheet__r.Contact__r.User__r.Name
                    : tse.TimeSheet__r.Job__r.Name;
                if (tse.Entry_Date__c == StartDate) {
                    ts.Day1 += tse.Total_Clock_In_Time__c;
                    tst.Day1 += tse.Total_Clock_In_Time__c;
                } else if (tse.Entry_Date__c == StartDate.addDays(1)) {
                    ts.Day2 += tse.Total_Clock_In_Time__c;
                    tst.Day2 += tse.Total_Clock_In_Time__c;
                } else if (tse.Entry_Date__c == StartDate.addDays(2)) {
                    ts.Day3 += tse.Total_Clock_In_Time__c;
                    tst.Day3 += tse.Total_Clock_In_Time__c;
                } else if (tse.Entry_Date__c == StartDate.addDays(3)) {
                    ts.Day4 += tse.Total_Clock_In_Time__c;
                    tst.Day4 += tse.Total_Clock_In_Time__c;
                } else if (tse.Entry_Date__c == StartDate.addDays(4)) {
                    ts.Day5 += tse.Total_Clock_In_Time__c;
                    tst.Day5 += tse.Total_Clock_In_Time__c;
                } else if (tse.Entry_Date__c == StartDate.addDays(5)) {
                    ts.Day6 += tse.Total_Clock_In_Time__c;
                    tst.Day6 += tse.Total_Clock_In_Time__c;
                } else if (tse.Entry_Date__c == StartDate.addDays(6)) {
                    ts.Day7 += tse.Total_Clock_In_Time__c;
                    tst.Day7 += tse.Total_Clock_In_Time__c;
                }
                ts.Total += tse.Total_Clock_In_Time__c;
                timeSheetMap.put(rId, ts);
            }
            tst.Total += tse.Total_Clock_In_Time__c;
        }
        tst.timeSheetList = timeSheetMap.values();
        return tst;
    }
    
    public class timeSheetTotal {
        @AuraEnabled
        public String title;
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
        @AuraEnabled
        public List<timeSheet> timeSheetList;
    }
    
    public class timeSheet {
        @AuraEnabled
        public String title;
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
}