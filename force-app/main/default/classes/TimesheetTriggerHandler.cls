public with sharing class TimesheetTriggerHandler {
    List<Timesheet__c> newRecordList = new List<Timesheet__c>();
    List<Timesheet__c> oldRecordList = new List<Timesheet__c>();
    Map<Id, Timesheet__c> newRecordMap = new Map<Id, Timesheet__c>();
    Map<Id, Timesheet__c> oldRecordMap = new Map<Id, Timesheet__c>();
    
    public static Boolean recursionController = false;
    
    public TimesheetTriggerHandler(
        List<Timesheet__c> newList,
        List<Timesheet__c> oldList,
        Map<Id, Timesheet__c> newMap,
        Map<Id, Timesheet__c> oldMap
    ) {
        this.newRecordList = newList;
        this.oldRecordList = oldList;
        this.newRecordMap = newMap;
        this.oldRecordMap = oldMap;
    }
    
    public void AfterUpdateEvent() {
        if (!recursionController) {
            recursionController = true;
            List<Timesheet__c> tsListToUpdate = new List<Timesheet__c>();
            for (Timesheet__c ts : newRecordList) {
                if (ts.Time_In__c != null && ts.Time_Out__c != null && ts.Do_Not_Execute__c == false) {
                    if(Trigger.isUpdate) {
                        Timesheet__c oldTimesheet = oldRecordMap.get(ts.Id);
                        if(oldTimesheet.Time_Out__c != ts.Time_Out__c) {
                            tsListToUpdate.add(ts);   
                        }   
                    } else {
                        tsListToUpdate.add(ts);
                    }
                }
            }
            manageTimesheetEntries(tsListToUpdate);
        }
    }
    
    public void manageTimesheetEntries(List<Timesheet__c> tsList) {
        String soql = 'SELECT Id, Entry_Date__c, TimeSheet__c FROM Timesheet_Entry__c '+
            'WHERE TimeSheet__c IN :arg1 AND Entry_Date__c = :arg2';
        
        List<Timesheet_Entry__c> tseList = Lib_Security.ws().dbQuery(soql, new Object[]{tsList,system.today()});
        
        Map<Id, Timesheet_Entry__c> tseMap = new Map<Id, Timesheet_Entry__c>();
        for (Timesheet_Entry__c tse : tseList)
            if (!tseMap.containsKey(tse.TimeSheet__c))
            tseMap.put(tse.TimeSheet__c, tse);
        List<Timesheet_Entry__c> newTseList = new List<Timesheet_Entry__c>();
        
        for (Timesheet__c ts : tsList) {
            if (!tseMap.containsKey(ts.Id)) {
                Timesheet_Entry__c tse = new Timesheet_Entry__c();
                
                tse.TimeSheet__c = ts.Id;
                tse.Entry_Date__c = ts.Time_In__c.date();
                //tse.Entry_Date__c = System.today();
                newTseList.add(tse);
            }
        }
        
        if (!newTseList.isEmpty()) {
            
            Lib_Security.ws().dbInsert(newTseList);
            for (Timesheet_Entry__c tse : newTseList)
                if (!tseMap.containsKey(tse.TimeSheet__c))
                tseMap.put(tse.TimeSheet__c, tse);
        }
        
        List<Timesheet__c> timesheetUpdateList = new List<Timesheet__c>();
        List<Timesheet_Entry_Item__c> tseiList = new List<Timesheet_Entry_Item__c>();
        for (Timesheet__c ts : tsList) {
            Timesheet_Entry_Item__c item = new Timesheet_Entry_Item__c();
            item.Timesheet_Entry__c = tseMap.get(ts.Id).Id;
            item.Clock_In_Time__c = ts.Time_In__c;
            item.Clock_Out_Time__c = ts.Time_Out__c > ts.Time_In__c ? ts.Time_Out__c : null ;
            if(TimeSheetReportController.checkCostCodeAccess()) {
             	item.Cost_Code__c = ts.Cost_Code__c;   
            }
            item.Clock_In_Location__latitude__s = ts.Time_In_Geolocation__latitude__s;
            item.Clock_In_Location__longitude__s = ts.Time_In_Geolocation__longitude__s;
            item.Clock_Out_Location__latitude__s = ts.Time_Out_Geolocation__latitude__s;
            item.Clock_Out_Location__longitude__s = ts.Time_Out_Geolocation__longitude__s;
            tseiList.add(item);
        }
        if (!tseiList.isEmpty())
            Lib_Security.ws().dbInsert(tseiList);
    }
}