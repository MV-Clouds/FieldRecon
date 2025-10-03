/**
* Class Name: JobDetailsPageController
* Test Class: JobDetailsPageControllerTest
* @description: Controller for Job Details Page
* Created Date: 29 September 2025
* Created By: Harsh Gandhi
*--------------------------------------------------------------------------------
* Modification History:
* Date Modified - Developer Name - Description
* 
**/
public with sharing class JobDetailsPageController {
    
    /*
    *********************************************************
    @description     : Method is used to get the job related mobilization details
    @param           : filterDate - {Date} - Date to filter the mobilization details
    @param           : mode - {String} - Mode to filter the mobilization details
    @return          : List<Mobilization__c> - List of mobilization details
    ********************************************************
    */
    @AuraEnabled
    public static List<Mobilization__c> getJobRelatedMoblizationDetails(Date filterDate, String mode) {
        try {
            DateTime startOfDay;
            DateTime endOfDay;
    
            if (mode == 'week') {
                // Convert to DateTime to get day of week
                DateTime dt = DateTime.newInstance(filterDate, Time.newInstance(0, 0, 0, 0));
    
                // Apex: DateTime.format('u') → 1=Monday ... 7=Sunday
                Integer dow = Integer.valueOf(dt.format('u'));
    
                // We want weeks Sunday–Saturday
                // If dow=7, it's already Sunday → startOfWeek = filterDate
                // Else subtract dow days to go back to Sunday
                Date startOfWeek = dow == 7 ? filterDate : filterDate.addDays(-dow);
                Date endOfWeek   = startOfWeek.addDays(6);
    
                startOfDay = DateTime.newInstance(startOfWeek, Time.newInstance(0,0,0,0));
                endOfDay   = DateTime.newInstance(endOfWeek,   Time.newInstance(23,59,59,999));
            } else {
                // Default = single day
                startOfDay = DateTime.newInstance(filterDate, Time.newInstance(0,0,0,0));
                endOfDay   = DateTime.newInstance(filterDate, Time.newInstance(23,59,59,999));
            }
    
            return [
                SELECT Id, Job__c, Job__r.Id, Start_Date__c, End_Date__c, Mobilization_Status__c, Job__r.Name, Job__r.Job_Name__c, Job__r.Address__c, Job__r.Description__c
                FROM Mobilization__c
                WHERE Start_Date__c >= :startOfDay 
                AND Start_Date__c <= :endOfDay 
                WITH SECURITY_ENFORCED
                ORDER BY Start_Date__c ASC
            ];
        } catch (Exception e) {
            System.debug('Exception in getJobRelatedMoblizationDetails: ' + e.getMessage());
            return null;
        }
    }

    /*
    *********************************************************
    @description     : Method is used to get the job related timesheet details
    @param           : jobId - {String} - Job Id to filter the timesheet details
    @param           : jobStartDate - {String} - Job Start Date to filter the timesheet details
    @return          : List<Timesheet_Entry_Item__c> - List of timesheet entry items
    ********************************************************
    */
    @AuraEnabled
    public static List<Timesheet_Entry_Item__c> getTimeSheetEntryItems(String jobId, String jobStartDate){
        try {
            System.debug('jobId: ' + jobId);
            System.debug('jobStartDate: ' + jobStartDate);
            System.debug('Date.valueOf(jobStartDate): ' + Date.valueOf(jobStartDate));
            return [
                SELECT Id, Timesheet_Entry__r.TimeSheet__r.Contact__r.Name, Clock_In_Time__c, Clock_Out_Time__c, Travel_Time__c, Total_Time__c, Cost_Code__r.Name, Clock_In_Date__c 
                FROM Timesheet_Entry_Item__c 
                WHERE Timesheet_Entry__r.TimeSheet__r.Job__c = :jobId 
                AND Clock_In_Date__c = :Date.valueOf(jobStartDate) 
                WITH SECURITY_ENFORCED
            ];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Method is used to get the mobilization related member details
    @param           : mobId - {Id} - Mobilization Id to filter the mobilization details
    @return          : Map<String, List<WrapperMember>> - Map of wrapper members
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, List<WrapperMember>> getMobilizationMembersWithStatus(Id mobId) {
        Map<String, List<WrapperMember>> result = new Map<String, List<WrapperMember>>();
        result.put('clockIn', new List<WrapperMember>());
        result.put('clockOut', new List<WrapperMember>());
        result.put('costCodeDetails', new List<WrapperMember>());

        List<Mobilization__c> mobilizationRecord = [
            SELECT Id, Job__c, Start_Date__c, End_Date__c
            FROM Mobilization__c
            WHERE Id = :mobId 
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];

        // 1. Fetch Members
        List<Mobilization_Member__c> members = [
            SELECT Id, Contact__c, Contact__r.Name, Contact__r.RecordType.DeveloperName, Contact__r.Can_Clock_In_Out__c, Mobilization__r.Job__c
            FROM Mobilization_Member__c
            WHERE Mobilization__c = :mobId
            AND Contact__c != null
            AND (Contact__r.RecordType.DeveloperName IN ('Employee_WF_Recon','Sub_Contractor_WF_Recon'))
            AND Contact__r.Can_Clock_In_Out__c = true
            WITH SECURITY_ENFORCED
        ];

        Set<Id> contactIds = new Set<Id>();
        Id jobId;
        for (Mobilization_Member__c m : members) {
            contactIds.add(m.Contact__c);
            jobId = m.Mobilization__r.Job__c; 
        }
        System.debug('contactIds: ' + contactIds);
        System.debug('jobId: ' + jobId);

        if (contactIds.isEmpty()) {
            return result;
        }

        // 2. Fetch Timesheets for those contacts for that job and date
        List<Timesheet__c> tsList = [
            SELECT Id, Contact__c, Timesheet_Start_Date__c, Timesheet_End_Date__c
            FROM Timesheet__c
            WHERE Contact__c IN :contactIds
            AND Job__c = :jobId
            AND Timesheet_Start_Date__c <= :Date.valueOf(mobilizationRecord[0].Start_Date__c)
            AND Timesheet_End_Date__c >= :Date.valueOf(mobilizationRecord[0].End_Date__c)
            WITH SECURITY_ENFORCED
        ];
        System.debug('tsList: ' + tsList.size());
        Map<Id, Timesheet__c> contactTimesheetMap = new Map<Id, Timesheet__c>();
        for (Timesheet__c ts : tsList) {
            System.debug('ts.Ids: ' + ts.Id);
            contactTimesheetMap.put(ts.Contact__c, ts);
        }

        // 3. Fetch Entries for those timesheets for that date
        Date startDate = mobilizationRecord[0].Start_Date__c.date(); // extract only date part
        List<Timesheet_Entry__c> entries = [
            SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Timesheet__r.Contact__c
            FROM Timesheet_Entry__c
            WHERE Timesheet__c IN :tsList
            AND Clock_In_Time__c >= :startDate
            AND Clock_In_Time__c < :startDate.addDays(1)
            WITH SECURITY_ENFORCED
        ];
        System.debug('entries: ' + entries.size());
        
        // Instead of just overwriting, handle properly
        Map<Id, Timesheet_Entry__c> tsEntryMap = new Map<Id, Timesheet_Entry__c>();
        for (Timesheet_Entry__c e : entries) {
            // Only take the first matching entry for that contact for now
            if (!tsEntryMap.containsKey(e.Timesheet__r.Contact__c)) {
                tsEntryMap.put(e.Timesheet__r.Contact__c, e);
            }
        }

        // 4. Build wrapper list
        for (Mobilization_Member__c m : members) {
            WrapperMember wrap = new WrapperMember();
            wrap.jobStartTime = mobilizationRecord[0].Start_Date__c.formatGmt('yyyy-MM-dd\'T\'HH:mm:ss');
            wrap.jobEndTime = mobilizationRecord[0].End_Date__c.formatGmt('yyyy-MM-dd\'T\'HH:mm:ss');
            wrap.contactId = m.Contact__c;
            wrap.contactName = m.Contact__r.Name;
            wrap.mobMemberId = m.Id;

            Timesheet__c ts = contactTimesheetMap.get(m.Contact__c); // check if Timesheet exists
            Timesheet_Entry__c entry = tsEntryMap.get(m.Contact__c);

            if (ts == null) {
                // No Timesheet exists → assign to clockIn
                wrap.isTimesheetNull = true;
                wrap.isTimesheetEntryNull = true;
                result.get('clockIn').add(wrap);
            } else if (entry == null) {
                // No entry today at all → eligible to Clock In
                wrap.timesheetId = ts.Id;
                wrap.isTimeSheetNull = false;
                wrap.isTimesheetEntryNull = true;
                result.get('clockIn').add(wrap);
            } else if (entry.Clock_In_Time__c == null && entry.Clock_Out_Time__c == null) {
                // Edge case: entry exists but both fields are null → treat as not clocked in yet
                wrap.timesheetId = ts.Id;
                wrap.isTimeSheetNull = false;
                wrap.timesheetEntryId = entry.Id;
                wrap.isTimeSheetEntryNull = false;
                result.get('clockIn').add(wrap);
            } else if (entry.Clock_In_Time__c != null && entry.Clock_Out_Time__c == null) {
                // Clocked in but not clocked out → show Clock Out
                wrap.timesheetId = ts.Id;
                wrap.isTimeSheetNull = false;
                wrap.timesheetEntryId = entry.Id;
                wrap.isTimeSheetEntryNull = false;
                wrap.clockInTime = entry.Clock_In_Time__c.formatGmt('yyyy-MM-dd\'T\'HH:mm:ss');
                result.get('clockOut').add(wrap);
            }
            // else: already completed (both in/out filled), don’t show
        }

        // 5. Build cost code details
        Map<Id, String> costCodeDetails = new Map<Id, String>();
        List<Cost_Code__c> costCodeRecs = [SELECT Id, Name FROM Cost_Code__c];
        for (Cost_Code__c c : costCodeRecs) {
            costCodeDetails.put(c.Id, c.Name);
        }
        WrapperMember costCodeDetailsWrap = new WrapperMember();
        costCodeDetailsWrap.costCodeDetails = costCodeDetails;
        result.get('costCodeDetails').add(costCodeDetailsWrap);

        return result;
    }

    /*
    *********************************************************
    @description     : Method is used to create timesheet records
    @param           : params - {String} - Parameters to create timesheet records
    @return          : Boolean - Success or failure of the operation
    ********************************************************
    */
    @AuraEnabled
    public static Boolean createTimesheetRecords(String params){
        try {
            Map<String, Object> paramsMap = (Map<String, Object>) JSON.deserializeUntyped(params);
            System.debug(paramsMap);
            
            List<Mobilization_Member__c> mobMemberRecs = [SELECT Id, Contact__c, Mobilization__r.Mobilization_Group__r.Start_Date__c, Mobilization__r.Mobilization_Group__r.End_Date__c FROM Mobilization_Member__c WHERE Id = :(String)paramsMap.get('mobMemberId')];

            if((String) paramsMap.get('actionType') == 'clockIn') {
                
                // Convert clockInTime to UTC
                String clockInTimeString = (String)paramsMap.get('clockInTime');
                clockInTimeString = clockInTimeString.replace('T', ' ').replace('Z', '');
                DateTime utcDateTime = DateTime.valueOf(clockInTimeString);
                // Convert UTC to user's timezone
                TimeZone userTz = UserInfo.getTimeZone();
                Datetime clkInUserTz = utcDateTime.addSeconds(userTz.getOffset(utcDateTime)/1000);

                // If first clockin for moblization group for contact > Create Timesheet and Timesheet Entry
                if(paramsMap.get('isTimeSheetNull') == true) {
                    Timesheet__c timesheetRec = new Timesheet__c();
                    timesheetRec.Contact__c = mobMemberRecs[0].Contact__c;
                    timesheetRec.Job__c = (String)paramsMap.get('jobId');
                    timesheetRec.Timesheet_Start_Date__c = mobMemberRecs[0].Mobilization__r.Mobilization_Group__r.Start_Date__c.date();
                    timesheetRec.Timesheet_End_Date__c = mobMemberRecs[0].Mobilization__r.Mobilization_Group__r.End_Date__c.date();
                    timesheetRec.Do_Not_Execute__c = true;
                    insert as user timesheetRec;
    
                    Timesheet_Entry__c timesheetEntryRec = new Timesheet_Entry__c();
                    timesheetEntryRec.Timesheet__c = timesheetRec.Id;
                    timesheetEntryRec.Clock_In_Time__c = clkInUserTz;
                    timesheetEntryRec.Cost_Code__c = (String)paramsMap.get('costCodeId');
                    timesheetEntryRec.Do_Not_Execute__c = true;
                    insert as user timesheetEntryRec;
                } else {
                    List<Timesheet__c> timesheetRecs = [SELECT Id FROM Timesheet__c WHERE Id = :(String)paramsMap.get('timesheetId')];
                    
                    Timesheet_Entry__c timesheetEntryRec = new Timesheet_Entry__c();
                    timesheetEntryRec.Timesheet__c = timesheetRecs[0].Id;
                    timesheetEntryRec.Clock_In_Time__c = clkInUserTz;
                    timesheetEntryRec.Cost_Code__c = (String)paramsMap.get('costCodeId');
                    timesheetEntryRec.Do_Not_Execute__c = true;
                    insert as user timesheetEntryRec;
                }
            }

            if((String) paramsMap.get('actionType') == 'clockOut') {

                // Convert clockOutTime to UTC
                String clockOutTimeString = (String)paramsMap.get('clockOutTime');
                clockOutTimeString = clockOutTimeString.replace('T', ' ').replace('Z', '');
                DateTime utcDateTime = DateTime.valueOf(clockOutTimeString);
                // Convert UTC to user's timezone
                TimeZone userTz = UserInfo.getTimeZone();
                Datetime clkOutUserTz = utcDateTime.addSeconds(userTz.getOffset(utcDateTime)/1000);

                // Convert clockInTime to UTC
                String clockInTimeString = (String)paramsMap.get('clockInTime');
                clockInTimeString = clockInTimeString.replace('T', ' ').replace('Z', '');
                DateTime utcDateTimeCI = DateTime.valueOf(clockInTimeString);
                // Convert UTC to user's timezone
                Datetime clkInUserTz = utcDateTime.addSeconds(userTz.getOffset(utcDateTimeCI)/1000);

                if(paramsMap.get('isTimeSheetEntryNull') == true) {
                    if(paramsMap.get('isTimeSheetNull') == false) {
                        List<Timesheet__c> timesheetRecs = [SELECT Id FROM Timesheet__c WHERE Id = :(String)paramsMap.get('timesheetId')];

                        Timesheet_Entry__c timesheetEntryRec = new Timesheet_Entry__c();
                        timesheetEntryRec.Timesheet__c = timesheetRecs[0].Id;
                        timesheetEntryRec.Clock_In_Time__c = clkInUserTz;
                        timesheetEntryRec.Clock_Out_Time__c = clkOutUserTz;
                        timesheetEntryRec.Do_Not_Execute__c = true;
                        insert as user timesheetEntryRec;

                        Timesheet_Entry_Item__c timesheetEntryItemRec = new Timesheet_Entry_Item__c();
                        timesheetEntryItemRec.Timesheet_Entry__c = timesheetEntryRec.Id;
                        timesheetEntryItemRec.Clock_In_Time__c = timesheetEntryRec.Clock_In_Time__c;
                        timesheetEntryItemRec.Clock_Out_Time__c = timesheetEntryRec.Clock_Out_Time__c;
                        timesheetEntryItemRec.Cost_Code__c = timesheetEntryRec.Cost_Code__c;
                        timesheetEntryItemRec.Do_Not_Execute__c = true;
                        insert as user timesheetEntryItemRec;
                    }
                } else {
                    List<Timesheet_Entry__c> timesheetEntryRecs = [SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Cost_Code__c FROM Timesheet_Entry__c WHERE Id = :(String)paramsMap.get('timesheetEntryId')];
                    timesheetEntryRecs[0].Clock_Out_Time__c = clkOutUserTz;
                    update as user timesheetEntryRecs;
    
                    Timesheet_Entry_Item__c timesheetEntryItemRec = new Timesheet_Entry_Item__c();
                    timesheetEntryItemRec.Timesheet_Entry__c = timesheetEntryRecs[0].Id;
                    timesheetEntryItemRec.Clock_In_Time__c = timesheetEntryRecs[0].Clock_In_Time__c;
                    timesheetEntryItemRec.Clock_Out_Time__c = timesheetEntryRecs[0].Clock_Out_Time__c;
                    timesheetEntryItemRec.Cost_Code__c = timesheetEntryRecs[0].Cost_Code__c;
                    timesheetEntryItemRec.Do_Not_Execute__c = true;
                    insert as user timesheetEntryItemRec;
                }
            }

            return true;
        } catch (Exception e) {
            System.debug(e.getMessage());
            return false;
        }
    }

    /*
    *********************************************************
    @description     : Method is used to get the contact and costcode details
    @return          : Map<String, Object> - Map of contacts and cost codes
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getContactsAndCostcode(){
        try {
            List<Contact> allContactsRecs = [
                SELECT Id, Name 
                FROM Contact 
                WHERE RecordType.DeveloperName IN ('Employee_WF_Recon','Sub_Contractor_WF_Recon')
                WITH SECURITY_ENFORCED
                ORDER BY Name ASC
            ];

            Map<String, Object> result = new Map<String, Object>();
            result.put('contacts', allContactsRecs);

            List<Cost_Code__c> costCodeRecs = [SELECT Id, Name FROM Cost_Code__c ORDER BY Name ASC];
            result.put('costCodes', costCodeRecs);

            return result;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Method is used to create manual timesheet records
    @param           : params - {String} - Parameters to create timesheet records
    @return          : Boolean - Success or failure of the operation
    ********************************************************
    */
    @AuraEnabled
    public static Boolean createManualTimesheetRecords(String params){
        try {
            Map<String, Object> paramsMap = (Map<String, Object>) JSON.deserializeUntyped(params);
            System.debug(paramsMap);

            // Convert clockOutTime to UTC
            String clockOutTimeString = (String)paramsMap.get('clockOutTime');
            clockOutTimeString = clockOutTimeString.replace('T', ' ').replace('Z', '') + ':00';
            DateTime utcDateTime = DateTime.valueOf(clockOutTimeString);
            // Convert UTC to user's timezone
            TimeZone userTz = UserInfo.getTimeZone();
            Datetime clkOutUserTz = utcDateTime.addSeconds(userTz.getOffset(utcDateTime)/1000);

            // Convert clockInTime to UTC
            String clockInTimeString = (String)paramsMap.get('clockInTime');
            clockInTimeString = clockInTimeString.replace('T', ' ').replace('Z', '') + ':00';
            DateTime utcDateTimeCI = DateTime.valueOf(clockInTimeString);
            // Convert UTC to user's timezone
            Datetime clkInUserTz = utcDateTime.addSeconds(userTz.getOffset(utcDateTimeCI)/1000);

            String contactId = (String)paramsMap.get('contactId');
            String jobId = (String)paramsMap.get('jobId');
            String mobId = (String)paramsMap.get('mobId');
            String costCodeId = (String)paramsMap.get('costCodeId');
            Date jobStartDate = Date.valueOf((String)paramsMap.get('jobStartDate'));
            Date jobEndDate = Date.valueOf((String)paramsMap.get('jobEndDate'));

            List<Timesheet__c> tsList = [
                SELECT Id, Contact__c, Timesheet_Start_Date__c, Timesheet_End_Date__c
                FROM Timesheet__c
                WHERE Contact__c = :contactId
                AND Job__c = :jobId
                AND Timesheet_Start_Date__c <= :jobStartDate
                AND Timesheet_End_Date__c >= :jobEndDate
                WITH SECURITY_ENFORCED
            ];
            
            Timesheet__c tsRec = new Timesheet__c();

            if(tsList.size() == 0) {
                List<Mobilization__c> mobRec = [
                    SELECT Id, Name, Mobilization_Group__r.Start_Date__c, Mobilization_Group__r.End_Date__c 
                    FROM Mobilization__c 
                    WHERE Id = :mobId
                    WITH SECURITY_ENFORCED
                ];

                Timesheet__c timesheetRec = new Timesheet__c();
                timesheetRec.Contact__c = contactId;
                timesheetRec.Job__c = (String)paramsMap.get('jobId');
                timesheetRec.Timesheet_Start_Date__c = mobRec[0].Mobilization_Group__r.Start_Date__c.date();
                timesheetRec.Timesheet_End_Date__c = mobRec[0].Mobilization_Group__r.End_Date__c.date();
                timesheetRec.Do_Not_Execute__c = true;
                insert as user timesheetRec;

                tsRec = timesheetRec;
            } else {
                tsRec = tsList[0];
            }

            Timesheet_Entry__c timesheetEntryRec = new Timesheet_Entry__c();
            timesheetEntryRec.Timesheet__c = tsRec.Id;
            timesheetEntryRec.Clock_In_Time__c = clkInUserTz;
            timesheetEntryRec.Clock_Out_Time__c = clkOutUserTz;
            timesheetEntryRec.Cost_Code__c = costCodeId;
            timesheetEntryRec.Do_Not_Execute__c = true;
            insert as user timesheetEntryRec;

            Timesheet_Entry_Item__c timesheetEntryItemRec = new Timesheet_Entry_Item__c();
            timesheetEntryItemRec.Timesheet_Entry__c = timesheetEntryRec.Id;
            timesheetEntryItemRec.Clock_In_Time__c = clkInUserTz;
            timesheetEntryItemRec.Clock_Out_Time__c = clkOutUserTz;
            timesheetEntryItemRec.Cost_Code__c = costCodeId;
            timesheetEntryItemRec.Do_Not_Execute__c = true;
            insert as user timesheetEntryItemRec;

            return true;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /*
    *********************************************************
    @description     : Method is used to save travel time on timesheet records
    @param           : params - {String} - Parameters to create timesheet records
    @return          : Boolean - Success or failure of the operation
    ********************************************************
    */
    @AuraEnabled
    public static Boolean saveTravelTimeOnTimesheets(String params){
        try {
            List<Object> jsonList = (List<Object>) JSON.deserializeUntyped(params);

            // Prepare Ids to query
            List<Id> recordIds = new List<Id>();
            Map<Id, Decimal> travelTimeMap = new Map<Id, Decimal>();

            for (Object obj : jsonList) {
                Map<String, Object> rec = (Map<String, Object>) obj;
                Id recId = (Id) rec.get('Id');
                Decimal travelTime = rec.get('wfrecon__Travel_Time__c') != null 
                    ? Decimal.valueOf(String.valueOf(rec.get('wfrecon__Travel_Time__c'))) 
                    : 0;
                recordIds.add(recId);
                travelTimeMap.put(recId, travelTime);
            }

            // Query records
            List<Timesheet_Entry_Item__c> tsItems = [
                SELECT Id, wfrecon__Travel_Time__c 
                FROM Timesheet_Entry_Item__c 
                WHERE Id IN :recordIds
                WITH SECURITY_ENFORCED
            ];

            // Update travel time
            for (Timesheet_Entry_Item__c item : tsItems) {
                if (travelTimeMap.containsKey(item.Id)) {
                    item.wfrecon__Travel_Time__c = travelTimeMap.get(item.Id);
                }
            }

            update as user tsItems;

            return true;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    public class WrapperMember {
        @AuraEnabled public Id contactId;
        @AuraEnabled public String contactName;
        @AuraEnabled public String jobStartTime;
        @AuraEnabled public String jobEndTime;
        @AuraEnabled public String clockInTime;
        @AuraEnabled public Boolean isTimesheetNull;
        @AuraEnabled public String timesheetId;
        @AuraEnabled public Boolean isTimesheetEntryNull;
        @AuraEnabled public String timesheetEntryId;
        @AuraEnabled public String mobMemberId;
        @AuraEnabled public Map<Id, String> costCodeDetails;
        @AuraEnabled public String displayName {
            get {
                return contactName;
            }
        }
    }
}