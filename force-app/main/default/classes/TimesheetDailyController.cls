public with sharing class TimesheetDailyController {
    public static List<Timesheet__c> weeklyTimedetail { get; set; }
    
    @AuraEnabled
    public static DefaultValues getDefault() {
        String soql ='SELECT Id, Week_Start_Day__c FROM Default_Values__c WITH SECURITY_ENFORCED ORDER BY CreatedDate DESC LIMIT 1';
        
        List<Default_Values__c> DefaultList = Lib_Security.ws().dbQuery(soql, new Object[]{});
        return new DefaultValues(DefaultList[0]);
    }
    
    @AuraEnabled
    public static List<Timesheet__c> getTimesheetDetail(
        String recordId,
        Date StartDate,
        Date EndDate,
        String selectedUser
    ) {
        String timedetail =
            'SELECT Job__r.Name, ' + Util.getDynamicFields('Timesheet__c', '');
        timedetail += ' FROM Timesheet__c WHERE Timesheet_Start_Date__c >=:arg1 AND Timesheet_End_Date__c <=:arg2 AND Job__c =:arg3 AND Contact__r.User__c =:arg4';
        weeklyTimedetail = Lib_Security.ws().dbQuery(timedetail, new Object[]{StartDate,EndDate,recordId,selectedUser});
        return weeklyTimedetail;
    }
    public class DefaultValues {
        @AuraEnabled
        public String id{get;set;}
        @AuraEnabled
        public String weekStartDay{get;set;}
        public DefaultValues(Default_Values__c defVals) {
            this.id = defVals?.Id;
            this.weekStartDay = defVals?.Week_Start_Day__c;
        }
    }
}