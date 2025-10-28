public with sharing class ShiftEndLogController {
    @AuraEnabled
    public static Boolean checkLevelAccess(){
        return Util.thirdLevelFeatureAccess();
    }
    @AuraEnabled
    public static void initialShiftEndLog(String jobId,String jsonData){
        LogEntry logEntryObj = (LogEntry)JSON.deserialize(jsonData, LogEntry.class);
        if(logEntryObj != null){
            wfrecon__Log_Entry__c log = new wfrecon__Log_Entry__c(wfrecon__Job__c =jobId,wfrecon__Log_Type__c='Shift End',
            wfrecon__Plan_for_Tomorrow__c=logEntryObj.tomorrowsPlan,wfrecon__Work_Performed__c=logEntryObj.workPerformed,
            wfrecon__Work_Performed_Date__c=logEntryObj.workPerformedDate,wfrecon__Material_Usage_Complete__c=logEntryObj.materialUsage,
            wfrecon__Processes_Updated__c=logEntryObj.processUpdated,wfrecon__Time_Entries_Complete__c=logEntryObj.timeEntries,
            wfrecon__Travel_Log_Complete__c=logEntryObj.travelLog); 
            Lib_Security.ws().dbInsert(new wfrecon__Log_Entry__c[]{log});
        }
    }
    class LogEntry{
        @AuraEnabled public String workPerformed{get;set;}
        @AuraEnabled public Date workPerformedDate{get;set;}
        @AuraEnabled public String tomorrowsPlan{get;set;}
        @AuraEnabled public Boolean processUpdated{get;set;}
        @AuraEnabled public Boolean travelLog{get;set;}
        @AuraEnabled public Boolean timeEntries{get;set;}
        @AuraEnabled public Boolean materialUsage{get;set;}
    }
}