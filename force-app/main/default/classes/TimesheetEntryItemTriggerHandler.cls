public with sharing class TimesheetEntryItemTriggerHandler {
    List<Timesheet_Entry_Item__c> newRecordList = new List<Timesheet_Entry_Item__c>();
    List<Timesheet_Entry_Item__c> oldRecordList = new List<Timesheet_Entry_Item__c>();
    Map<Id, Timesheet_Entry_Item__c> newRecordMap = new Map<Id, Timesheet_Entry_Item__c>();
    Map<Id, Timesheet_Entry_Item__c> oldRecordMap = new Map<Id, Timesheet_Entry_Item__c>();

    public TimesheetEntryItemTriggerHandler(
        List<Timesheet_Entry_Item__c> newList,
        List<Timesheet_Entry_Item__c> oldList,
        Map<Id, Timesheet_Entry_Item__c> newMap,
        Map<Id, Timesheet_Entry_Item__c> oldMap
    ) {
        this.newRecordList = newList;
        this.oldRecordList = oldList;
        this.newRecordMap = newMap;
        this.oldRecordMap = oldMap;
    }

    public void AfterInsertEvent() {
        List<Timesheet_Entry_Item__c> insertedList = new List<Timesheet_Entry_Item__c>();
        for (Timesheet_Entry_Item__c tsei : newRecordList) {
            insertedList.add(tsei);
        }
        String soql =
            'SELECT Timesheet_Entry__r.TimeSheet__c FROM Timesheet_Entry_Item__c ' +
            'WHERE id IN :arg1 AND Clock_In_Time__c != null WITH SECURITY_ENFORCED';

        List<Id> tseiId = new List<Id>();

        for (
            Timesheet_Entry_Item__c tsei : (Timesheet_Entry_Item__c[]) Lib_Security.ws()
                .dbQuery(soql, new List<Object>{ insertedList })
        ) {
            tseiId.add(tsei.Timesheet_Entry__r.TimeSheet__c);
        }

        //Ignore CRUD/FLS as this should always run
        List<Timesheet__c> tsList = [
            SELECT
                Id,
                Time_In__c,
                Time_Out__c,
                Time_In_Geolocation__latitude__s,
                Time_In_Geolocation__longitude__s,
                Time_Out_Geolocation__latitude__s,
                Time_Out_Geolocation__longitude__s
            FROM Timesheet__c
            WHERE Id IN :tseiId AND Time_In__c != null
        ];
        for (Timesheet__c ts : tsList) {
            ts.Time_In_Geolocation__latitude__s = null;
            ts.Time_In_Geolocation__longitude__s = null;
            ts.Time_Out_Geolocation__latitude__s = null;
            ts.Time_Out_Geolocation__longitude__s = null;
        }
        //Ignore CRUD/FLS as this should always run
        update tsList;
    }
}