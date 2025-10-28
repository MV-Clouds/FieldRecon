public with sharing class UpdateTimesheetBatch implements Database.Batchable<sObject>, Database.Stateful {
    public Database.QueryLocator start(Database.BatchableContext BC) {
        Date weekStart = System.today().toStartOfWeek();
        Date weekEnd = System.today().toStartOfWeek().addDays(6);

        String query =
            ' SELECT Id,' +
            '        Time_In__c, ' +
            '        Time_Out__c, ' +
            '        Job__c, ' +
            '        Contact__c, ' +
            '        Time_In_Geolocation__latitude__s, ' +
            '        Time_In_Geolocation__longitude__s, ' +
            '        Time_Out_Geolocation__latitude__s, ' +
            '        Time_Out_Geolocation__longitude__s, ' +
            '        Cost_Code__c, ' +
            '        Timesheet_Start_Date__c, ' +
            '        Timesheet_End_Date__c ' +
            '   FROM Timesheet__c ' +
            '    WHERE Time_In__c != null ' +
            '    AND Time_Out__c = null ' +
            ' ORDER BY CreatedDate DESC';

        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext BC, List<Timesheet__c> scope) {
        //Ignore CRUD/FLS as this should always run
        Date entryDate = System.today().addDays(-1);
        List<Timesheet_Entry__c> tseList = [
            SELECT Id, Entry_Date__c, TimeSheet__c
            FROM Timesheet_Entry__c
            WHERE TimeSheet__c IN :scope AND Entry_Date__c = :entryDate
        ];

        Map<Id, Timesheet_Entry__c> tseMap = new Map<Id, Timesheet_Entry__c>();

        for (Timesheet_Entry__c tse : tseList) {
            if (!tseMap.containsKey(tse.TimeSheet__c))
                tseMap.put(tse.TimeSheet__c, tse);
        }

        List<Timesheet_Entry__c> newTseList = new List<Timesheet_Entry__c>();

        for (Timesheet__c ts : scope) {
            if (!tseMap.containsKey(ts.Id)) {
                Timesheet_Entry__c tse = new Timesheet_Entry__c();
                tse.TimeSheet__c = ts.Id;
                tse.Entry_Date__c = System.today() - 1;
                newTseList.add(tse);
            }
        }
        if (!newTseList.isEmpty()) {
            Lib_Security.ws().dbInsert(newTseList);
            for (Timesheet_Entry__c tse : newTseList) {
                if (!tseMap.containsKey(tse.TimeSheet__c))
                    tseMap.put(tse.TimeSheet__c, tse);
            }
        }
        List<Timesheet_Entry_Item__c> tseItemsList = new List<Timesheet_Entry_Item__c>();
        List<Timesheet__c> newTimesheetList = new List<Timesheet__c>();

        for (Timesheet__c ts : scope) {
            Timesheet_Entry_Item__c item = new Timesheet_Entry_Item__c();
            item.Timesheet_Entry__c = tseMap.get(ts.Id).Id;
            item.Clock_In_Time__c = ts.Time_In__c;
            item.Clock_Out_Time__c = DateTime.newInstance(
                ts.Time_In__c.year(),
                ts.Time_In__c.month(),
                ts.Time_In__c.day(),
                23,
                59,
                59
            );
            item.Cost_Code__c = ts.Cost_Code__c;
            item.Clock_In_Location__latitude__s = ts.Time_In_Geolocation__latitude__s;
            item.Clock_In_Location__longitude__s = ts.Time_In_Geolocation__longitude__s;
            item.Clock_Out_Location__latitude__s = ts.Time_In_Geolocation__latitude__s;
            item.Clock_Out_Location__longitude__s = ts.Time_In_Geolocation__longitude__s;
            tseItemsList.add(item);

            if (ts.Timesheet_End_Date__c < System.today()) {
                // execute when Week is changed

                // Create new Timesheets
                Timesheet__c tsObj = new Timesheet__c();
                tsObj.Job__c = ts.Job__c;
                tsObj.Contact__c = ts.Contact__c;
                tsObj.Time_In__c = DateTime.newInstance(
                    System.today().year(),
                    System.today().month(),
                    System.today().day(),
                    0,
                    0,
                    0
                );
                tsObj.Time_Out__c = null;
                tsObj.Timesheet_Start_Date__c = System.today().toStartOfWeek();
                tsObj.Timesheet_End_Date__c = System.today().toStartOfWeek().addDays(6);
                tsObj.Time_In_Geolocation__latitude__s = ts.Time_In_Geolocation__latitude__s;
                tsObj.Time_In_Geolocation__longitude__s = ts.Time_In_Geolocation__longitude__s;
                tsObj.Time_Out_Geolocation__latitude__s = null;
                tsObj.Time_Out_Geolocation__longitude__s = null;
                newTimesheetList.add(tsObj);

                // set null fields for timesheet when week is changed
                ts.Time_In__c = null;
                ts.Time_Out__c = null;
                ts.Time_In_Geolocation__latitude__s = null;
                ts.Time_In_Geolocation__longitude__s = null;
                ts.Time_Out_Geolocation__latitude__s = null;
                ts.Time_Out_Geolocation__longitude__s = null;
            } else {
                // set fields for timesheet when week is same
                ts.Time_In__c = DateTime.newInstance(
                    System.today().year(),
                    System.today().month(),
                    System.today().day(),
                    0,
                    0,
                    0
                );
                ts.Time_Out__c = null;
                ts.Time_Out_Geolocation__latitude__s = null;
                ts.Time_Out_Geolocation__longitude__s = null;
            }
        }
        //Ignore CRUD/FLS as this should always run
        if (!tseItemsList.isEmpty()) {
            insert tseItemsList;
        }
        update scope;
        //Ignore CRUD/FLS as this should always run
        if (!newTimesheetList.isEmpty()) {
            upsert newTimesheetList;
        }
    }

    public void finish(Database.BatchableContext BC) {
    }
}