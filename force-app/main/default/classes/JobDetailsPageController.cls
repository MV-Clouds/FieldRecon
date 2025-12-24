/**
* Class Name: JobDetailsPageController
* Test Class: JobDetailsPageControllerTest
* @description: Controller for Job Details Page
* Created Date: 29 September 2025
* Created By: Harsh Gandhi
*--------------------------------------------------------------------------------
*
**/
public with sharing class JobDetailsPageController {
    
    public static TimeZone userTz = UserInfo.getTimeZone();

    /*
    *********************************************************
    @description     : Method is used to get the job related mobilization details
    @param           : filterDate - {Date} - Date to filter the mobilization details
    @param           : mode - {String} - Mode to filter the mobilization details
    @return          : List<MobilizationWrapper> - List of mobilization details
    ********************************************************
    */
    @AuraEnabled
    public static List<MobilizationWrapper> getJobRelatedMoblizationDetails(Date filterDate, String mode, Date customStartDate, Date customEndDate) {
        try {
            System.debug('filterDate in apex: ' + filterDate);
            DateTime startOfDay;
            DateTime endOfDay;

            if (mode == 'custom' && customStartDate != null && customEndDate != null) {
                startOfDay = DateTime.newInstance(customStartDate, Time.newInstance(0,0,0,0));
                endOfDay   = DateTime.newInstance(customEndDate, Time.newInstance(23,59,59,999));
            } else if (mode == 'week') {
                DateTime dt = DateTime.newInstance(filterDate, Time.newInstance(0, 0, 0, 0));
                Integer dow = Integer.valueOf(dt.format('u')); // 1=Mon … 7=Sun
                Date startOfWeek = dow == 7 ? filterDate : filterDate.addDays(-dow);
                Date endOfWeek   = startOfWeek.addDays(6);

                startOfDay = DateTime.newInstance(startOfWeek, Time.newInstance(0,0,0,0));
                endOfDay   = DateTime.newInstance(endOfWeek,   Time.newInstance(23,59,59,999));
            } else {
                startOfDay = DateTime.newInstance(filterDate, Time.newInstance(0,0,0,0));
                endOfDay   = DateTime.newInstance(filterDate, Time.newInstance(23,59,59,999));
            }

            // 1. Fetch mobilizations
            List<wfrecon__Mobilization__c> mobs = [
                SELECT Id, wfrecon__Job__c, wfrecon__Job__r.Id, wfrecon__Start_Date__c, wfrecon__End_Date__c, wfrecon__Mobilization_Status__c, 
                    wfrecon__Job__r.Name, wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Job__r.wfrecon__Address__c, wfrecon__Job__r.wfrecon__Description__c, wfrecon__Job__r.wfrecon__Status__c
                FROM wfrecon__Mobilization__c
                WHERE wfrecon__Start_Date__c >= :startOfDay 
                AND wfrecon__Start_Date__c <= :endOfDay 
                WITH USER_MODE
                ORDER BY wfrecon__Start_Date__c ASC
            ];

            if (mobs.isEmpty()) return new List<MobilizationWrapper>();

            // 1. Build a Map of JobId → List of mobilization start dates
            Map<Id, Set<Date>> jobDateMap = new Map<Id, Set<Date>>();
            for(wfrecon__Mobilization__c m : mobs) {
                if(m.wfrecon__Job__c != null && m.wfrecon__Start_Date__c != null) {
                    if(!jobDateMap.containsKey(m.wfrecon__Job__c)) {
                        jobDateMap.put(m.wfrecon__Job__c, new Set<Date>());
                    }
                    jobDateMap.get(m.wfrecon__Job__c).add(m.wfrecon__Start_Date__c.date());
                }
            }

            // 2. Aggregate total hours for relevant Job + Dates
            Map<String, Decimal> mobManHoursMap = new Map<String, Decimal>();
            Map<String, Decimal> mobTotalHoursWithTravelMap = new Map<String, Decimal>();
            for (AggregateResult ar : [
                SELECT wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Job__c jobId,
                    wfrecon__Clock_In_Date__c workDate,
                    SUM(wfrecon__Total_Time__c) totalHours,
                    SUM(wfrecon__Travel_Time__c) travelTime
                FROM wfrecon__Timesheet_Entry_Item__c
                WHERE wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Job__c IN :jobDateMap.keySet()
                AND wfrecon__Clock_In_Date__c != null
                WITH USER_MODE
                GROUP BY wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Job__c, wfrecon__Clock_In_Date__c
            ]) {
                Id jobId = (Id)ar.get('jobId');
                Date workDate = (Date)ar.get('workDate');
                
                // Only include if the workDate matches a mobilization start date for that job
                if(jobDateMap.containsKey(jobId) && jobDateMap.get(jobId).contains(workDate)) {
                    String key = jobId + '_' + String.valueOf(workDate);
                    Decimal totalHrs = (Decimal)ar.get('totalHours') != null ? (Decimal)ar.get('totalHours') : 0;
                    Decimal travelHrs = (Decimal)ar.get('travelTime') != null ? (Decimal)ar.get('travelTime') : 0;
                    
                    mobManHoursMap.put(key, totalHrs);
                    mobTotalHoursWithTravelMap.put(key, totalHrs + travelHrs);
                }
            }
            
            // 2a. Count distinct clocked-in members per mobilization using aggregate queries
            // Build map: mobilization ID -> Set of contact IDs who have timesheet entries
            Map<Id, Set<Id>> mobContactMap = new Map<Id, Set<Id>>();
            
            // Aggregate query for complete timesheet entry items (GROUP BY for distinct contacts)
            for (AggregateResult ar : [
                SELECT wfrecon__Timesheet_Entry__r.wfrecon__Mobilization__c mobId,
                    wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Contact__c contactId
                FROM wfrecon__Timesheet_Entry_Item__c
                WHERE wfrecon__Timesheet_Entry__r.wfrecon__Mobilization__c IN :mobs
                AND wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Contact__c != null
                WITH USER_MODE
                GROUP BY wfrecon__Timesheet_Entry__r.wfrecon__Mobilization__c,
                    wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Contact__c
            ]) {
                Id mobId = (Id)ar.get('mobId');
                Id contactId = (Id)ar.get('contactId');
                
                if (!mobContactMap.containsKey(mobId)) {
                    mobContactMap.put(mobId, new Set<Id>());
                }
                mobContactMap.get(mobId).add(contactId);
            }
            
            // Aggregate query for clock-in-only entries (GROUP BY for distinct contacts)
            for (AggregateResult ar : [
                SELECT wfrecon__Mobilization__c mobId,
                    wfrecon__TimeSheet__r.wfrecon__Contact__c contactId
                FROM wfrecon__Timesheet_Entry__c
                WHERE wfrecon__Mobilization__c IN :mobs
                AND wfrecon__TimeSheet__r.wfrecon__Contact__c != null
                AND wfrecon__Clock_Out_Time__c = null
                WITH USER_MODE
                GROUP BY wfrecon__Mobilization__c,
                    wfrecon__TimeSheet__r.wfrecon__Contact__c
            ]) {
                Id mobId = (Id)ar.get('mobId');
                Id contactId = (Id)ar.get('contactId');
                
                if (!mobContactMap.containsKey(mobId)) {
                    mobContactMap.put(mobId, new Set<Id>());
                }
                mobContactMap.get(mobId).add(contactId);
            }

            // 3. Build wrappers
            List<MobilizationWrapper> result = new List<MobilizationWrapper>();
            for (wfrecon__Mobilization__c m : mobs) {
                MobilizationWrapper w = new MobilizationWrapper();
                w.mobId = m.Id;
                w.jobId = m.wfrecon__Job__c;
                w.jobNumber = m.wfrecon__Job__r.Name;
                w.jobName = m.wfrecon__Job__r.wfrecon__Job_Name__c != null ? m.wfrecon__Job__r.wfrecon__Job_Name__c : '--';
                w.jobAddress = m.wfrecon__Job__r.wfrecon__Address__c != null ? m.wfrecon__Job__r.wfrecon__Address__c : '--';
                w.jobDescription = m.wfrecon__Job__r.wfrecon__Description__c != null ? m.wfrecon__Job__r.wfrecon__Description__c : '--';
                w.startDate = m.wfrecon__Start_Date__c.addSeconds(userTz.getOffset(m.wfrecon__Start_Date__c)/1000);
                w.endDate = m.wfrecon__End_Date__c.addSeconds(userTz.getOffset(m.wfrecon__End_Date__c)/1000);
                // w.startDate = m.wfrecon__Start_Date__c;
                // w.endDate = m.wfrecon__End_Date__c;
                // w.status = m.wfrecon__Job__r.wfrecon__Status__c != null ? m.wfrecon__Job__r.wfrecon__Status__c : '--';

                // Lookup hours
                String key = m.wfrecon__Job__c + '_' + String.valueOf(m.wfrecon__Start_Date__c.date());
                w.totalManHours = mobManHoursMap.containsKey(key) ? mobManHoursMap.get(key) : 0.00;
                w.totalHoursWithTravel = mobTotalHoursWithTravelMap.containsKey(key) ? mobTotalHoursWithTravelMap.get(key) : 0.00;
                
                // Lookup clocked-in members count
                Set<Id> uniqueContacts = mobContactMap.get(m.Id);
                w.clockedInMembersCount = uniqueContacts != null ? uniqueContacts.size() : 0;

                result.add(w);
            }

            return result;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobDetailsPageController', 'methodName' => 'getJobRelatedMoblizationDetails', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    /*
    *********************************************************
    @description     : Method is used to get the job related timesheet details
    @param           : jobId - {String} - Job Id to filter the timesheet details
    @param           : jobStartDate - {String} - Job Start Date to filter the timesheet details
    @return          : List<TimesheetEntryItemWrapper> - List of timesheet entry items
    ********************************************************
    */
    @AuraEnabled
    public static List<TimesheetEntryItemWrapper> getTimeSheetEntryItems(String jobId, Date jobStartDate, Date jobEndDate){
        try {
            // 1. Fetch clock-in-only entries (TSE without clock-out)
            List<wfrecon__Timesheet_Entry__c> clockInOnlyEntries = [
                SELECT Id, Name, wfrecon__TimeSheet__c, wfrecon__Clock_In_Time__c, 
                       wfrecon__Clock_Out_Time__c, wfrecon__Cost_Code__r.Name, wfrecon__Cost_Code__c,
                       wfrecon__TimeSheet__r.wfrecon__Contact__r.Name, wfrecon__Mobilization__c,
                       wfrecon__Clock_In_Date__c, wfrecon__TimeSheet__r.wfrecon__Job__c
                FROM wfrecon__Timesheet_Entry__c 
                WHERE wfrecon__TimeSheet__r.wfrecon__Job__c = :jobId
                  AND wfrecon__Clock_In_Date__c >= :jobStartDate
                  AND wfrecon__Clock_In_Date__c <= :jobEndDate
                  AND wfrecon__Clock_Out_Time__c = null
                WITH USER_MODE
                ORDER BY wfrecon__Clock_In_Time__c ASC
            ];

            // 2. Fetch complete entries (TSELI with both clock-in and clock-out)
            List<wfrecon__Timesheet_Entry_Item__c> items = [
                SELECT Id, wfrecon__Timesheet_Entry__c, 
                       wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Contact__r.Name, 
                       wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Travel_Time__c, 
                       wfrecon__Per_Diem__c, wfrecon__Total_Time__c, 
                       wfrecon__Cost_Code__r.Name, wfrecon__Clock_In_Date__c, 
                       wfrecon__Clock_Out_Date__c, wfrecon__Premium__c,
                       wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__c, // Added TS Id
                       wfrecon__Cost_Code__c, // Added Cost Code Id
                       wfrecon__Timesheet_Entry__r.wfrecon__Mobilization__c // Added Mob Id
                FROM wfrecon__Timesheet_Entry_Item__c 
                 WHERE wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Job__c = :jobId
                  AND wfrecon__Clock_In_Date__c >= :jobStartDate
                  AND wfrecon__Clock_Out_Date__c <= :jobEndDate
                WITH USER_MODE
                ORDER BY wfrecon__Clock_In_Time__c ASC
            ];

            // 3. Build result list: clock-in-only entries first, then complete entries
            List<TimesheetEntryItemWrapper> result = new List<TimesheetEntryItemWrapper>();
            
            // Add clock-in-only entries (TSE)
            for(wfrecon__Timesheet_Entry__c entry : clockInOnlyEntries) {
                result.add(new TimesheetEntryItemWrapper(entry));
            }
            
            // Add complete entries (TSELI)
            for(wfrecon__Timesheet_Entry_Item__c item : items) {
                result.add(new TimesheetEntryItemWrapper(item));
            }

            return result;
        } catch (Exception e) {
            System.debug('Exception in getTimeSheetEntryItems: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobDetailsPageController', 'methodName' => 'getTimeSheetEntryItems', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
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
        try {
            Map<String, List<WrapperMember>> result = new Map<String, List<WrapperMember>>();
            result.put('clockIn', new List<WrapperMember>());
            result.put('clockOut', new List<WrapperMember>());
            result.put('costCodeDetails', new List<WrapperMember>());
    
            List<wfrecon__Mobilization__c> mobilizationRecord = [
                SELECT Id, wfrecon__Job__c, wfrecon__Start_Date__c, wfrecon__End_Date__c
                FROM wfrecon__Mobilization__c
                WHERE Id = :mobId 
                WITH USER_MODE
                LIMIT 1
            ];
            System.debug('mobilizationRecord.size() ::' + mobilizationRecord.size());

            // 1. Fetch Members
            List<wfrecon__Mobilization_Member__c> members = [
                SELECT Id, wfrecon__Contact__c, wfrecon__Contact__r.Name, wfrecon__Contact__r.RecordType.DeveloperName, wfrecon__Contact__r.wfrecon__Can_Clock_In_Out__c, wfrecon__Mobilization__r.wfrecon__Job__c
                FROM wfrecon__Mobilization_Member__c
                WHERE wfrecon__Mobilization__c = :mobId
                AND wfrecon__Contact__c != null
                AND (wfrecon__Contact__r.RecordType.DeveloperName IN ('Employee_WF_Recon','Sub_Contractor_WF_Recon'))
                AND wfrecon__Contact__r.wfrecon__Can_Clock_In_Out__c = true
                WITH USER_MODE
            ];
            System.debug('members.size() ::' + members.size());
    
            Set<Id> contactIds = new Set<Id>();
            Id jobId;
            for (wfrecon__Mobilization_Member__c m : members) {
                contactIds.add(m.wfrecon__Contact__c);
                jobId = m.wfrecon__Mobilization__r.wfrecon__Job__c; 
            }
            System.debug('contactIds: ' + contactIds);
            System.debug('jobId: ' + jobId);
    
            if (contactIds.isEmpty()) {
                return result;
            }
    
            // 2. Fetch Timesheets for those contacts for that job and date
            List<wfrecon__Timesheet__c> tsList = [
                SELECT Id, wfrecon__Contact__c, wfrecon__Timesheet_Start_Date__c, wfrecon__Timesheet_End_Date__c
                FROM wfrecon__Timesheet__c
                WHERE wfrecon__Contact__c IN :contactIds
                AND wfrecon__Job__c = :jobId
                AND wfrecon__Timesheet_Start_Date__c <= :Date.valueOf(mobilizationRecord[0].wfrecon__Start_Date__c)
                AND wfrecon__Timesheet_End_Date__c >= :Date.valueOf(mobilizationRecord[0].wfrecon__End_Date__c)
                WITH USER_MODE
            ];
            System.debug('tsList: ' + tsList.size());
            Map<Id, wfrecon__Timesheet__c> contactTimesheetMap = new Map<Id, wfrecon__Timesheet__c>();
            for (wfrecon__Timesheet__c ts : tsList) {
                System.debug('ts.Ids: ' + ts.Id);
                contactTimesheetMap.put(ts.wfrecon__Contact__c, ts);
            }
    
            // 3. Fetch Entries for those timesheets for that date
            Date startDate = mobilizationRecord[0].wfrecon__Start_Date__c.date(); // extract only date part
            Date endDate = mobilizationRecord[0].wfrecon__End_Date__c.date();     // extract only date part
            List<wfrecon__Timesheet_Entry__c> entries = [
                SELECT Id, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Timesheet__r.wfrecon__Contact__c
                FROM wfrecon__Timesheet_Entry__c
                WHERE wfrecon__Timesheet__c IN :tsList
                AND (wfrecon__Clock_In_Time__c >= :startDate
                OR wfrecon__Clock_In_Time__c <= :endDate.addDays(1))
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
            System.debug('entries: ' + entries.size());

            // Group entries by Contact
            Map<Id, List<wfrecon__Timesheet_Entry__c>> contactEntriesMap = new Map<Id, List<wfrecon__Timesheet_Entry__c>>();
            for (wfrecon__Timesheet_Entry__c e : entries) {
                if (!contactEntriesMap.containsKey(e.wfrecon__Timesheet__r.wfrecon__Contact__c)) {
                    contactEntriesMap.put(e.wfrecon__Timesheet__r.wfrecon__Contact__c, new List<wfrecon__Timesheet_Entry__c>());
                }
                contactEntriesMap.get(e.wfrecon__Timesheet__r.wfrecon__Contact__c).add(e);
            }
            System.debug('contactEntriesMap: ' + contactEntriesMap);

            // 4. Build wrapper list
            for (wfrecon__Mobilization_Member__c m : members) {
                WrapperMember wrap = new WrapperMember();
                wrap.jobStartTime = mobilizationRecord[0].wfrecon__Start_Date__c.addSeconds(userTz.getOffset(mobilizationRecord[0].wfrecon__Start_Date__c)/1000);
                wrap.jobEndTime = mobilizationRecord[0].wfrecon__End_Date__c.addSeconds(userTz.getOffset(mobilizationRecord[0].wfrecon__End_Date__c)/1000);
                wrap.contactId = m.wfrecon__Contact__c;
                wrap.contactName = m.wfrecon__Contact__r.Name;
                wrap.mobMemberId = m.Id;
    
                wfrecon__Timesheet__c ts = contactTimesheetMap.get(m.wfrecon__Contact__c);
                List<wfrecon__Timesheet_Entry__c> userEntries = contactEntriesMap.get(m.wfrecon__Contact__c);
    
                if (ts == null) {
                    wrap.isTimesheetNull = true;
                    wrap.isTimesheetEntryNull = true;
                    wrap.isAgain = false;
                    result.get('clockIn').add(wrap);
                    continue;
                }
    
                if (userEntries == null || userEntries.isEmpty()) {
                    wrap.timesheetId = ts.Id;
                    wrap.isTimeSheetNull = false;
                    wrap.isTimesheetEntryNull = true;
                    wrap.isAgain = false;
                    result.get('clockIn').add(wrap);
                    continue;
                }
    
                Boolean hasOpenEntry = false;
                Boolean hasCompletedEntry = false;
                wfrecon__Timesheet_Entry__c latestOpen;
                wfrecon__Timesheet_Entry__c latestCompleted;
                
                // Get most recent entry (first in list since ordered by CreatedDate DESC)
                wfrecon__Timesheet_Entry__c mostRecentEntry = userEntries[0];
                DateTime mostRecentClockIn = mostRecentEntry.wfrecon__Clock_In_Time__c;
                DateTime mostRecentClockOut = mostRecentEntry.wfrecon__Clock_Out_Time__c;
    
                for (wfrecon__Timesheet_Entry__c e : userEntries) {
                    if (e.wfrecon__Clock_In_Time__c != null && e.wfrecon__Clock_Out_Time__c == null) {
                        hasOpenEntry = true;
                        latestOpen = e;
                    } else if (e.wfrecon__Clock_In_Time__c != null && e.wfrecon__Clock_Out_Time__c != null) {
                        hasCompletedEntry = true;
                        latestCompleted = e;
                    } else if (e.wfrecon__Clock_In_Time__c == null && e.wfrecon__Clock_Out_Time__c != null) {
                        // Edge case → treat as open
                        hasOpenEntry = true;
                        latestOpen = e;
                    }
                }
    
                if (hasOpenEntry) {
                    // ClockOut case → must pass the ClockIn time
                    wrap.timesheetId = ts.Id;
                    wrap.isTimeSheetNull = false;
                    wrap.isTimeSheetEntryNull = false;
                    wrap.timesheetEntryId = latestOpen.Id;
                    wrap.clockInTime = (latestOpen.wfrecon__Clock_In_Time__c != null)
                        ? latestOpen.wfrecon__Clock_In_Time__c.addSeconds(userTz.getOffset(latestOpen.wfrecon__Clock_In_Time__c)/1000)
                        : null;
                    wrap.isAgain = false; // Not a new shift yet, finishing current one
                    wrap.recentClockIn = mostRecentClockIn != null ? mostRecentClockIn.addSeconds(userTz.getOffset(mostRecentClockIn)/1000) : null;
                    wrap.recentClockOut = mostRecentClockOut != null ? mostRecentClockOut.addSeconds(userTz.getOffset(mostRecentClockOut)/1000) : null;
                    result.get('clockOut').add(wrap);
                } else if (hasCompletedEntry) {
                    // Only completed entries → eligible for ClockIn again
                    wrap.timesheetId = ts.Id;
                    wrap.isTimeSheetNull = false;
                    wrap.isTimesheetEntryNull = true;
                    wrap.isAgain = true;  // ✅ Contact is clocking in AGAIN
                    wrap.recentClockIn = mostRecentClockIn != null ? mostRecentClockIn.addSeconds(userTz.getOffset(mostRecentClockIn)/1000) : null;
                    wrap.recentClockOut = mostRecentClockOut != null ? mostRecentClockOut.addSeconds(userTz.getOffset(mostRecentClockOut)/1000) : null;
                    result.get('clockIn').add(wrap);
                } else {
                    // Default → treat as new ClockIn
                    wrap.timesheetId = ts.Id;
                    wrap.isTimeSheetNull = false;
                    wrap.isTimesheetEntryNull = true;
                    wrap.isAgain = false;
                    result.get('clockIn').add(wrap);
                }
                
            }
            // 5. Build cost code details
            Map<Id, String> costCodeDetails = new Map<Id, String>();
            List<wfrecon__Cost_Code__c> costCodeRecs = [SELECT Id, Name FROM wfrecon__Cost_Code__c WITH USER_MODE];
            for (wfrecon__Cost_Code__c c : costCodeRecs) {
                costCodeDetails.put(c.Id, c.Name);
            }
            WrapperMember costCodeDetailsWrap = new WrapperMember();
            costCodeDetailsWrap.costCodeDetails = costCodeDetails;
            result.get('costCodeDetails').add(costCodeDetailsWrap);
            return result;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobDetailsPageController', 'methodName' => 'getMobilizationMembersWithStatus', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
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

            String jobId = (String)paramsMap.get('jobId');
            String mobId = (String)paramsMap.get('mobId');
            String mobGroupId;
            List<wfrecon__Mobilization__c> mobRec = [
                SELECT Id, Name, wfrecon__Mobilization_Group__r.wfrecon__Start_Date__c, wfrecon__Mobilization_Group__r.wfrecon__End_Date__c 
                FROM wfrecon__Mobilization__c 
                WHERE Id = :mobId
                WITH USER_MODE
            ];
            mobGroupId = mobRec[0].wfrecon__Mobilization_Group__r.Id;
            
            List<wfrecon__Mobilization_Member__c> mobMemberRecs = [SELECT Id, wfrecon__Contact__c, wfrecon__Mobilization__r.wfrecon__Mobilization_Group__r.wfrecon__Start_Date__c, wfrecon__Mobilization__r.wfrecon__Mobilization_Group__r.wfrecon__End_Date__c FROM wfrecon__Mobilization_Member__c WHERE Id = :(String)paramsMap.get('mobMemberId') WITH USER_MODE];

            if((String) paramsMap.get('actionType') == 'clockIn') {
                
                // Convert clockInTime to UTC to user timezone
                String clockInTimeString = (String)paramsMap.get('clockInTime');
                Datetime clkInUserTz = convertUtc(clockInTimeString);

                // Get geolocation data
                Decimal clockInLat = paramsMap.get('clockInLatitude') != null ? Decimal.valueOf(String.valueOf(paramsMap.get('clockInLatitude'))) : null;
                Decimal clockInLong = paramsMap.get('clockInLongitude') != null ? Decimal.valueOf(String.valueOf(paramsMap.get('clockInLongitude'))) : null;

                // If first clockin for moblization group for contact > Create Timesheet and Timesheet Entry
                if(paramsMap.get('isTimeSheetNull') == true) {
                    wfrecon__Timesheet__c timesheetRec = new wfrecon__Timesheet__c();
                    timesheetRec.wfrecon__Contact__c = mobMemberRecs[0].wfrecon__Contact__c;
                    timesheetRec.wfrecon__Job__c = jobId;
                    timesheetRec.wfrecon__Timesheet_Start_Date__c = mobMemberRecs[0].wfrecon__Mobilization__r.wfrecon__Mobilization_Group__r.wfrecon__Start_Date__c.date();
                    timesheetRec.wfrecon__Timesheet_End_Date__c = mobMemberRecs[0].wfrecon__Mobilization__r.wfrecon__Mobilization_Group__r.wfrecon__End_Date__c.date();
                    timesheetRec.wfrecon__Mobilization_Group__c = mobGroupId;
                    timesheetRec.wfrecon__Do_Not_Execute__c = true;
                    insert timesheetRec;
    
                    wfrecon__Timesheet_Entry__c timesheetEntryRec = new wfrecon__Timesheet_Entry__c();
                    timesheetEntryRec.wfrecon__Timesheet__c = timesheetRec.Id;
                    timesheetEntryRec.wfrecon__Clock_In_Time__c = clkInUserTz;
                    timesheetEntryRec.wfrecon__Cost_Code__c = (String)paramsMap.get('costCodeId');
                    timesheetEntryRec.wfrecon__Mobilization__c = mobId;
                    timesheetEntryRec.wfrecon__Do_Not_Execute__c = true;
                    // Set Clock In Location
                    if(clockInLat != null && clockInLong != null) {
                        timesheetEntryRec.wfrecon__Clock_In_Location__Latitude__s = clockInLat;
                        timesheetEntryRec.wfrecon__Clock_In_Location__Longitude__s = clockInLong;
                    }
                    insert timesheetEntryRec;
                } else {
                    List<wfrecon__Timesheet__c> timesheetRecs = [SELECT Id FROM wfrecon__Timesheet__c WHERE Id = :(String)paramsMap.get('timesheetId') WITH USER_MODE];
                    
                    wfrecon__Timesheet_Entry__c timesheetEntryRec = new wfrecon__Timesheet_Entry__c();
                    timesheetEntryRec.wfrecon__Timesheet__c = timesheetRecs[0].Id;
                    timesheetEntryRec.wfrecon__Clock_In_Time__c = clkInUserTz;
                    timesheetEntryRec.wfrecon__Cost_Code__c = (String)paramsMap.get('costCodeId');
                    timesheetEntryRec.wfrecon__Mobilization__c = mobId;
                    timesheetEntryRec.wfrecon__Do_Not_Execute__c = true;
                    // Set Clock In Location
                    if(clockInLat != null && clockInLong != null) {
                        timesheetEntryRec.wfrecon__Clock_In_Location__Latitude__s = clockInLat;
                        timesheetEntryRec.wfrecon__Clock_In_Location__Longitude__s = clockInLong;
                    }
                    insert timesheetEntryRec;
                }
            }

            if((String) paramsMap.get('actionType') == 'clockOut') {

                // Convert clockOutTime to UTC to user timezone
                String clockOutTimeString = (String)paramsMap.get('clockOutTime');
                Datetime clkOutUserTz = convertUtc(clockOutTimeString);

                // Convert clockInTime to UTC to user timezone
                String clockInTimeString = (String)paramsMap.get('clockInTime');
                Datetime clkInUserTz  = Datetime.valueOfGmt(clockInTimeString.replace('T',' ').replace('Z',''));

                // Get geolocation data
                Decimal clockOutLat = paramsMap.get('clockOutLatitude') != null ? Decimal.valueOf(String.valueOf(paramsMap.get('clockOutLatitude'))) : null;
                Decimal clockOutLong = paramsMap.get('clockOutLongitude') != null ? Decimal.valueOf(String.valueOf(paramsMap.get('clockOutLongitude'))) : null;

                // Helper to check date difference
                Boolean crossesMidnight = (clkInUserTz.date() != clkOutUserTz.date());

                if(paramsMap.get('isTimeSheetEntryNull') == true) {
                    if(paramsMap.get('isTimeSheetNull') == false) {
                        List<wfrecon__Timesheet__c> timesheetRecs = [SELECT Id FROM wfrecon__Timesheet__c WHERE Id = :(String)paramsMap.get('timesheetId') WITH USER_MODE];

                        if (!timesheetRecs.isEmpty()) {
                            Id tsId = timesheetRecs[0].Id;
                            
                            if (crossesMidnight) {
                                // 🕛 Split Entry Across Two Days
                                Datetime firstDayEnd = DateTime.newInstance(clkInUserTz.date(), Time.newInstance(23, 59, 59, 999));
                                Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));

                                // 1️⃣ Entry for Day 1 (till 11:59 PM)
                                wfrecon__Timesheet_Entry__c entryDay1 = new wfrecon__Timesheet_Entry__c(
                                    wfrecon__Timesheet__c = tsId,
                                    wfrecon__Clock_In_Time__c = clkInUserTz,
                                    wfrecon__Clock_Out_Time__c = firstDayEnd,
                                    wfrecon__Mobilization__c = mobId,
                                    wfrecon__Do_Not_Execute__c = true
                                );
                                // Set Clock Out Location for Day 1 (midnight)
                                if(clockOutLat != null && clockOutLong != null) {
                                    entryDay1.wfrecon__Clock_Out_Location__Latitude__s = clockOutLat;
                                    entryDay1.wfrecon__Clock_Out_Location__Longitude__s = clockOutLong;
                                }
                                insert entryDay1;

                                wfrecon__Timesheet_Entry_Item__c itemDay1 = new wfrecon__Timesheet_Entry_Item__c(
                                    wfrecon__Timesheet_Entry__c = entryDay1.Id,
                                    wfrecon__Clock_In_Time__c = entryDay1.wfrecon__Clock_In_Time__c,
                                    wfrecon__Clock_Out_Time__c = entryDay1.wfrecon__Clock_Out_Time__c,
                                    wfrecon__Do_Not_Execute__c = true
                                );
                                // Set Clock Out Location for Item Day 1
                                if(clockOutLat != null && clockOutLong != null) {
                                    itemDay1.wfrecon__Clock_Out_Location__Latitude__s = clockOutLat;
                                    itemDay1.wfrecon__Clock_Out_Location__Longitude__s = clockOutLong;
                                }
                                insert itemDay1;

                                // 2️⃣ Entry for Day 2 (from 12:00 AM)
                                wfrecon__Timesheet_Entry__c entryDay2 = new wfrecon__Timesheet_Entry__c(
                                    wfrecon__Timesheet__c = tsId,
                                    wfrecon__Clock_In_Time__c = secondDayStart,
                                    wfrecon__Clock_Out_Time__c = clkOutUserTz,
                                    wfrecon__Mobilization__c = mobId,
                                    wfrecon__Do_Not_Execute__c = true
                                );
                                // Set Clock Out Location for Day 2
                                if(clockOutLat != null && clockOutLong != null) {
                                    entryDay2.wfrecon__Clock_Out_Location__Latitude__s = clockOutLat;
                                    entryDay2.wfrecon__Clock_Out_Location__Longitude__s = clockOutLong;
                                }
                                insert entryDay2;

                                wfrecon__Timesheet_Entry_Item__c itemDay2 = new wfrecon__Timesheet_Entry_Item__c(
                                    wfrecon__Timesheet_Entry__c = entryDay2.Id,
                                    wfrecon__Clock_In_Time__c = entryDay2.wfrecon__Clock_In_Time__c,
                                    wfrecon__Clock_Out_Time__c = entryDay2.wfrecon__Clock_Out_Time__c,
                                    wfrecon__Do_Not_Execute__c = true
                                );
                                // Set Clock Out Location for Item Day 2
                                if(clockOutLat != null && clockOutLong != null) {
                                    itemDay2.wfrecon__Clock_Out_Location__Latitude__s = clockOutLat;
                                    itemDay2.wfrecon__Clock_Out_Location__Longitude__s = clockOutLong;
                                }
                                insert itemDay2;

                            } else {
                                wfrecon__Timesheet_Entry__c timesheetEntryRec = new wfrecon__Timesheet_Entry__c();
                                timesheetEntryRec.wfrecon__Timesheet__c = timesheetRecs[0].Id;
                                timesheetEntryRec.wfrecon__Clock_In_Time__c = clkInUserTz;
                                timesheetEntryRec.wfrecon__Clock_Out_Time__c = clkOutUserTz;
                                timesheetEntryRec.wfrecon__Mobilization__c = mobId;
                                timesheetEntryRec.wfrecon__Do_Not_Execute__c = true;
                                // Set Clock Out Location
                                if(clockOutLat != null && clockOutLong != null) {
                                    timesheetEntryRec.wfrecon__Clock_Out_Location__Latitude__s = clockOutLat;
                                    timesheetEntryRec.wfrecon__Clock_Out_Location__Longitude__s = clockOutLong;
                                }
                                insert timesheetEntryRec;
        
                                wfrecon__Timesheet_Entry_Item__c timesheetEntryItemRec = new wfrecon__Timesheet_Entry_Item__c();
                                timesheetEntryItemRec.wfrecon__Timesheet_Entry__c = timesheetEntryRec.Id;
                                timesheetEntryItemRec.wfrecon__Clock_In_Time__c = timesheetEntryRec.wfrecon__Clock_In_Time__c;
                                timesheetEntryItemRec.wfrecon__Clock_Out_Time__c = timesheetEntryRec.wfrecon__Clock_Out_Time__c;
                                timesheetEntryItemRec.wfrecon__Cost_Code__c = timesheetEntryRec.wfrecon__Cost_Code__c;
                                timesheetEntryItemRec.wfrecon__Do_Not_Execute__c = true;
                                // Set Clock Out Location for Item
                                if(clockOutLat != null && clockOutLong != null) {
                                    timesheetEntryItemRec.wfrecon__Clock_Out_Location__Latitude__s = clockOutLat;
                                    timesheetEntryItemRec.wfrecon__Clock_Out_Location__Longitude__s = clockOutLong;
                                }
                                insert timesheetEntryItemRec;
                            }
                        }
                    }
                } else {
                    List<wfrecon__Timesheet_Entry__c> timesheetEntryRecs = [SELECT Id, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Cost_Code__c, wfrecon__Timesheet__c, wfrecon__Clock_In_Location__Latitude__s, wfrecon__Clock_In_Location__Longitude__s FROM wfrecon__Timesheet_Entry__c WHERE Id = :(String)paramsMap.get('timesheetEntryId') WITH USER_MODE];
                    if (!timesheetEntryRecs.isEmpty()) {
                        wfrecon__Timesheet_Entry__c existing = timesheetEntryRecs[0];
                        Boolean crossesMidnightExisting = (existing.wfrecon__Clock_In_Time__c.date() != clkOutUserTz.date());

                        if (crossesMidnightExisting) {
                            Datetime firstDayEnd = DateTime.newInstance(existing.wfrecon__Clock_In_Time__c.date(), Time.newInstance(23, 59, 59, 999));
                            Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));

                            // Update existing entry to end at 11:59 PM
                            existing.wfrecon__Clock_Out_Time__c = firstDayEnd;
                            // Set Clock Out Location
                            if(clockOutLat != null && clockOutLong != null) {
                                existing.wfrecon__Clock_Out_Location__Latitude__s = clockOutLat;
                                existing.wfrecon__Clock_Out_Location__Longitude__s = clockOutLong;
                            }
                            update existing;

                            // Create Timesheet Entry Item for day 1
                            wfrecon__Timesheet_Entry_Item__c itemDay1 = new wfrecon__Timesheet_Entry_Item__c(
                                wfrecon__Timesheet_Entry__c = existing.Id,
                                wfrecon__Clock_In_Time__c = existing.wfrecon__Clock_In_Time__c,
                                wfrecon__Clock_Out_Time__c = existing.wfrecon__Clock_Out_Time__c,
                                wfrecon__Cost_Code__c = existing.wfrecon__Cost_Code__c,
                                wfrecon__Do_Not_Execute__c = true
                            );
                            // Copy Clock In Location from Entry
                            if(existing.wfrecon__Clock_In_Location__Latitude__s != null && existing.wfrecon__Clock_In_Location__Longitude__s != null) {
                                itemDay1.wfrecon__Clock_In_Location__Latitude__s = existing.wfrecon__Clock_In_Location__Latitude__s;
                                itemDay1.wfrecon__Clock_In_Location__Longitude__s = existing.wfrecon__Clock_In_Location__Longitude__s;
                            }
                            // Set Clock Out Location
                            if(clockOutLat != null && clockOutLong != null) {
                                itemDay1.wfrecon__Clock_Out_Location__Latitude__s = clockOutLat;
                                itemDay1.wfrecon__Clock_Out_Location__Longitude__s = clockOutLong;
                            }
                            insert itemDay1;

                            // Create new entry for next day
                            wfrecon__Timesheet_Entry__c entryDay2 = new wfrecon__Timesheet_Entry__c(
                                wfrecon__Timesheet__c = existing.wfrecon__Timesheet__c,
                                wfrecon__Clock_In_Time__c = secondDayStart,
                                wfrecon__Clock_Out_Time__c = clkOutUserTz,
                                wfrecon__Cost_Code__c = existing.wfrecon__Cost_Code__c,
                                wfrecon__Mobilization__c = mobId,
                                wfrecon__Do_Not_Execute__c = true
                            );
                            // Set Clock Out Location for Day 2
                            if(clockOutLat != null && clockOutLong != null) {
                                entryDay2.wfrecon__Clock_Out_Location__Latitude__s = clockOutLat;
                                entryDay2.wfrecon__Clock_Out_Location__Longitude__s = clockOutLong;
                            }
                            insert entryDay2;

                            // Create Timesheet Entry Item for day 2
                            wfrecon__Timesheet_Entry_Item__c itemDay2 = new wfrecon__Timesheet_Entry_Item__c(
                                wfrecon__Timesheet_Entry__c = entryDay2.Id,
                                wfrecon__Clock_In_Time__c = entryDay2.wfrecon__Clock_In_Time__c,
                                wfrecon__Clock_Out_Time__c = entryDay2.wfrecon__Clock_Out_Time__c,
                                wfrecon__Cost_Code__c = entryDay2.wfrecon__Cost_Code__c,
                                wfrecon__Do_Not_Execute__c = true
                            );
                            // Set Clock Out Location for Item Day 2
                            if(clockOutLat != null && clockOutLong != null) {
                                itemDay2.wfrecon__Clock_Out_Location__Latitude__s = clockOutLat;
                                itemDay2.wfrecon__Clock_Out_Location__Longitude__s = clockOutLong;
                            }
                            insert itemDay2;
                        } else {
                            // Normal same-day update
                            existing.wfrecon__Clock_Out_Time__c = clkOutUserTz;
                            // Set Clock Out Location
                            if(clockOutLat != null && clockOutLong != null) {
                                existing.wfrecon__Clock_Out_Location__Latitude__s = clockOutLat;
                                existing.wfrecon__Clock_Out_Location__Longitude__s = clockOutLong;
                            }
                            update existing;

                            wfrecon__Timesheet_Entry_Item__c item = new wfrecon__Timesheet_Entry_Item__c(
                                wfrecon__Timesheet_Entry__c = existing.Id,
                                wfrecon__Clock_In_Time__c = existing.wfrecon__Clock_In_Time__c,
                                wfrecon__Clock_Out_Time__c = existing.wfrecon__Clock_Out_Time__c,
                                wfrecon__Cost_Code__c = existing.wfrecon__Cost_Code__c,
                                wfrecon__Do_Not_Execute__c = true
                            );
                            // Copy Clock In Location from Entry
                            if(existing.wfrecon__Clock_In_Location__Latitude__s != null && existing.wfrecon__Clock_In_Location__Longitude__s != null) {
                                item.wfrecon__Clock_In_Location__Latitude__s = existing.wfrecon__Clock_In_Location__Latitude__s;
                                item.wfrecon__Clock_In_Location__Longitude__s = existing.wfrecon__Clock_In_Location__Longitude__s;
                            }
                            // Set Clock Out Location
                            if(clockOutLat != null && clockOutLong != null) {
                                item.wfrecon__Clock_Out_Location__Latitude__s = clockOutLat;
                                item.wfrecon__Clock_Out_Location__Longitude__s = clockOutLong;
                            }
                            insert item;
                        }
                    }
                }
            }

            return true;
        } catch (Exception e) {
            System.debug(e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobDetailsPageController', 'methodName' => 'createTimesheetRecords', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
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
                WITH USER_MODE
                ORDER BY Name ASC
            ];

            Map<String, Object> result = new Map<String, Object>();
            result.put('contacts', allContactsRecs);

            List<wfrecon__Cost_Code__c> costCodeRecs = [SELECT Id, Name FROM wfrecon__Cost_Code__c WITH USER_MODE ORDER BY Name ASC];
            result.put('costCodes', costCodeRecs);

            return result;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobDetailsPageController', 'methodName' => 'getContactsAndCostcode', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
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

            // Convert clockOutTime to UTC to user timezone
            String clockOutTimeString = (String)paramsMap.get('clockOutTime');
            Datetime clkOutUserTz = convertUtc(clockOutTimeString);

            // Convert clockInTime to UTC to user timezone
            String clockInTimeString = (String)paramsMap.get('clockInTime');
            Datetime clkInUserTz = convertUtc(clockInTimeString);

            String contactId = (String)paramsMap.get('contactId');
            String jobId = (String)paramsMap.get('jobId');
            String mobId = (String)paramsMap.get('mobId');
            String costCodeId = (String)paramsMap.get('costCodeId');
            Date jobStartDate = Date.valueOf((String)paramsMap.get('jobStartDate'));
            Date jobEndDate = Date.valueOf((String)paramsMap.get('jobEndDate'));
            Double travelTime = Double.valueOf((String)paramsMap.get('travelTime'));
            Integer perDiem = Integer.valueOf((String)paramsMap.get('perDiem'));
            String mobGroupId;
            List<wfrecon__Mobilization__c> mobRec = [
                SELECT Id, Name, wfrecon__Mobilization_Group__r.wfrecon__Start_Date__c, wfrecon__Mobilization_Group__r.wfrecon__End_Date__c 
                FROM wfrecon__Mobilization__c 
                WHERE Id = :mobId
                WITH USER_MODE
            ];
            mobGroupId = mobRec[0].wfrecon__Mobilization_Group__r.Id;

            List<wfrecon__Timesheet__c> tsList = [
                SELECT Id, wfrecon__Contact__c, wfrecon__Timesheet_Start_Date__c, wfrecon__Timesheet_End_Date__c
                FROM wfrecon__Timesheet__c
                WHERE wfrecon__Contact__c = :contactId
                AND wfrecon__Job__c = :jobId
                AND wfrecon__Timesheet_Start_Date__c <= :jobStartDate
                AND wfrecon__Timesheet_End_Date__c >= :jobEndDate
                WITH USER_MODE
            ];
            
            wfrecon__Timesheet__c tsRec = new wfrecon__Timesheet__c();

            if(tsList.size() == 0) {

                wfrecon__Timesheet__c timesheetRec = new wfrecon__Timesheet__c();
                timesheetRec.wfrecon__Contact__c = contactId;
                timesheetRec.wfrecon__Job__c = jobId;
                timesheetRec.wfrecon__Timesheet_Start_Date__c = mobRec[0].wfrecon__Mobilization_Group__r.wfrecon__Start_Date__c.date();
                timesheetRec.wfrecon__Timesheet_End_Date__c = mobRec[0].wfrecon__Mobilization_Group__r.wfrecon__End_Date__c.date();
                timesheetRec.wfrecon__Do_Not_Execute__c = true;
                timesheetRec.wfrecon__Mobilization_Group__c = mobGroupId;
                insert as user timesheetRec;

                tsRec = timesheetRec;
            } else {
                tsRec = tsList[0];
            }
            Boolean crossesMidnight = (clkInUserTz.date() != clkOutUserTz.date());

            if (crossesMidnight) {
                // Split into 2 entries
                Datetime firstDayEnd = DateTime.newInstance(clkInUserTz.date(), Time.newInstance(23, 59, 59, 999));
                Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));

                // Entry for day 1
                wfrecon__Timesheet_Entry__c entryDay1 = new wfrecon__Timesheet_Entry__c(
                    wfrecon__Timesheet__c = tsRec.Id,
                    wfrecon__Clock_In_Time__c = clkInUserTz,
                    wfrecon__Clock_Out_Time__c = firstDayEnd,
                    wfrecon__Cost_Code__c = costCodeId,
                    wfrecon__Mobilization__c = mobId,
                    wfrecon__Do_Not_Execute__c = true
                );
                insert as user entryDay1;

                wfrecon__Timesheet_Entry_Item__c itemDay1 = new wfrecon__Timesheet_Entry_Item__c(
                    wfrecon__Timesheet_Entry__c = entryDay1.Id,
                    wfrecon__Clock_In_Time__c = clkInUserTz,
                    wfrecon__Clock_Out_Time__c = firstDayEnd,
                    wfrecon__Cost_Code__c = costCodeId,
                    wfrecon__Travel_Time__c = travelTime,
                    wfrecon__Per_Diem__c = perDiem,
                    wfrecon__Do_Not_Execute__c = true
                );
                insert as user itemDay1;

                // Entry for day 2
                wfrecon__Timesheet_Entry__c entryDay2 = new wfrecon__Timesheet_Entry__c(
                    wfrecon__Timesheet__c = tsRec.Id,
                    wfrecon__Clock_In_Time__c = secondDayStart,
                    wfrecon__Clock_Out_Time__c = clkOutUserTz,
                    wfrecon__Cost_Code__c = costCodeId,
                    wfrecon__Mobilization__c = mobId,
                    wfrecon__Do_Not_Execute__c = true
                );
                insert as user entryDay2;

                wfrecon__Timesheet_Entry_Item__c itemDay2 = new wfrecon__Timesheet_Entry_Item__c(
                    wfrecon__Timesheet_Entry__c = entryDay2.Id,
                    wfrecon__Clock_In_Time__c = secondDayStart,
                    wfrecon__Clock_Out_Time__c = clkOutUserTz,
                    wfrecon__Cost_Code__c = costCodeId,
                    wfrecon__Do_Not_Execute__c = true
                );
                insert as user itemDay2;
            } else {
                // Normal same-day record
                wfrecon__Timesheet_Entry__c timesheetEntryRec = new wfrecon__Timesheet_Entry__c();
                timesheetEntryRec.wfrecon__Timesheet__c = tsRec.Id;
                timesheetEntryRec.wfrecon__Clock_In_Time__c = clkInUserTz;
                timesheetEntryRec.wfrecon__Clock_Out_Time__c = clkOutUserTz;
                timesheetEntryRec.wfrecon__Cost_Code__c = costCodeId;
                timesheetEntryRec.wfrecon__Do_Not_Execute__c = true;
                timesheetEntryRec.wfrecon__Mobilization__c = mobId;
                insert as user timesheetEntryRec;

                wfrecon__Timesheet_Entry_Item__c timesheetEntryItemRec = new wfrecon__Timesheet_Entry_Item__c();
                timesheetEntryItemRec.wfrecon__Timesheet_Entry__c = timesheetEntryRec.Id;
                timesheetEntryItemRec.wfrecon__Clock_In_Time__c = clkInUserTz;
                timesheetEntryItemRec.wfrecon__Clock_Out_Time__c = clkOutUserTz;
                timesheetEntryItemRec.wfrecon__Cost_Code__c = costCodeId;
                timesheetEntryItemRec.wfrecon__Travel_Time__c = travelTime;
                timesheetEntryItemRec.wfrecon__Per_Diem__c = perDiem;
                timesheetEntryItemRec.wfrecon__Do_Not_Execute__c = true;
                insert as user timesheetEntryItemRec;
            }

            return true;
        } catch (Exception e) {
            System.debug('Exception in createTimesheetRecords: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobDetailsPageController', 'methodName' => 'createManualTimesheetRecords', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return false;
        }
    }

    /*
    *********************************************************
    @description     : Method is used to save inline edits for multiple Timesheet Entry Items.
                       Updates Timesheet Entry if Clock In/Out times change.
    @param           : String updatedTimesheetEntriesJson - JSON string of updated timesheet entry items (TSELI)
    @return          : String - Success or error message
    ********************************************************
    */
    @AuraEnabled
    public static String saveTimesheetEntryInlineEdits(String updatedTimesheetEntriesJson) {
        
        // List to hold IDs of successfully inserted TSEs, used to link TSELI records
        List<wfrecon__Timesheet_Entry__c> insertedEntries = new List<wfrecon__Timesheet_Entry__c>();

        try {
            if (String.isBlank(updatedTimesheetEntriesJson)) {
                return 'Error: No timesheet entry item data provided for update.';
            }

            List<Object> rawUpdates = (List<Object>) JSON.deserializeUntyped(updatedTimesheetEntriesJson);

            Set<Id> tsEntryItemIds = new Set<Id>();
            Map<Id, Map<String, Object>> itemChangesMap = new Map<Id, Map<String, Object>>();

            for (Object obj : rawUpdates) {
                Map<String, Object> mapObj = (Map<String, Object>) obj;
                Id itemId = (Id) mapObj.get('Id');
                tsEntryItemIds.add(itemId);
                itemChangesMap.put(itemId, mapObj);
            }

            // Fetch current records and their parent Timesheet Entries
            List<wfrecon__Timesheet_Entry_Item__c> currentItems = [
                SELECT Id, wfrecon__Timesheet_Entry__c, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c,
                       wfrecon__Travel_Time__c, wfrecon__Per_Diem__c, wfrecon__Premium__c, wfrecon__Cost_Code__c
                FROM wfrecon__Timesheet_Entry_Item__c
                WHERE Id IN :tsEntryItemIds
                WITH USER_MODE
            ];

            Set<Id> tsEntryIds = new Set<Id>();
            for(wfrecon__Timesheet_Entry_Item__c item : currentItems) {
                tsEntryIds.add(item.wfrecon__Timesheet_Entry__c);
            }

            // Fetch parent TSEs and required lookups (Timesheet, Mobilization)
            Map<Id, wfrecon__Timesheet_Entry__c> tsEntryMap = new Map<Id, wfrecon__Timesheet_Entry__c>(
                [SELECT Id, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, 
                        wfrecon__Timesheet__c, wfrecon__Mobilization__c, wfrecon__Cost_Code__c 
                FROM wfrecon__Timesheet_Entry__c WHERE Id IN :tsEntryIds WITH USER_MODE]
            );

            // Lists for DML operations
            List<wfrecon__Timesheet_Entry_Item__c> itemsToUpdate = new List<wfrecon__Timesheet_Entry_Item__c>();
            List<wfrecon__Timesheet_Entry__c> entriesToUpdate = new List<wfrecon__Timesheet_Entry__c>();
            List<wfrecon__Timesheet_Entry__c> entriesToInsert = new List<wfrecon__Timesheet_Entry__c>();
            List<wfrecon__Timesheet_Entry_Item__c> itemsToInsert = new List<wfrecon__Timesheet_Entry_Item__c>();

            Integer newItemsCount = 0;

            for (wfrecon__Timesheet_Entry_Item__c currentItem : currentItems) {
                Map<String, Object> changes = itemChangesMap.get(currentItem.Id);
                wfrecon__Timesheet_Entry__c parentEntry = tsEntryMap.get(currentItem.wfrecon__Timesheet_Entry__c);

                // --- Determine New Values ---
                Datetime newClkInUserTz = currentItem.wfrecon__Clock_In_Time__c;
                Datetime newClkOutUserTz = currentItem.wfrecon__Clock_Out_Time__c;
                Decimal travelTime = currentItem.wfrecon__Travel_Time__c != null ? currentItem.wfrecon__Travel_Time__c : 0.00;
                Integer perDiem = currentItem.wfrecon__Per_Diem__c != null ? (Integer)currentItem.wfrecon__Per_Diem__c : 0;
                Boolean premium = currentItem.wfrecon__Premium__c != null ? currentItem.wfrecon__Premium__c : false;

                if (changes.containsKey('clockInTime')) {
                    newClkInUserTz = convertUtc((String)changes.get('clockInTime'));
                }
                if (changes.containsKey('clockOutTime')) {
                    newClkOutUserTz = convertUtc((String)changes.get('clockOutTime'));
                }
                
                if (changes.containsKey('travelTime')) {
                    travelTime = Decimal.valueOf((String)changes.get('travelTime'));
                }
                if (changes.containsKey('perDiem')) {
                    perDiem = Integer.valueOf((String)changes.get('perDiem'));
                }
                if (changes.containsKey('premium')) {
                    premium = Boolean.valueOf((String)changes.get('premium'));
                }

                Boolean crossesMidnight = (newClkInUserTz.date() != newClkOutUserTz.date());

                // 1. Prepare existing Timesheet Entry Item for update (TSELI)
                wfrecon__Timesheet_Entry_Item__c itemToUpdate = new wfrecon__Timesheet_Entry_Item__c(Id = currentItem.Id);
                itemToUpdate.wfrecon__Travel_Time__c = travelTime;
                itemToUpdate.wfrecon__Per_Diem__c = perDiem;
                itemToUpdate.wfrecon__Premium__c = premium;
                itemToUpdate.wfrecon__Do_Not_Execute__c = true; 

                wfrecon__Timesheet_Entry__c entryToUpdate = null;

                if (crossesMidnight) {
                    
                    // --- Midnight Split Logic ---
                    
                    Datetime firstDayEnd = DateTime.newInstance(newClkInUserTz.date(), Time.newInstance(23, 59, 59, 999));
                    Datetime secondDayStart = DateTime.newInstance(newClkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));

                    // A. Update Existing Item (Day 1)
                    itemToUpdate.wfrecon__Clock_In_Time__c = newClkInUserTz;
                    itemToUpdate.wfrecon__Clock_Out_Time__c = firstDayEnd;
                    itemsToUpdate.add(itemToUpdate);
                    
                    // Update Parent TSE (Day 1) - FLS FIX applied here
                    entryToUpdate = new wfrecon__Timesheet_Entry__c(
                        Id = parentEntry.Id,
                        wfrecon__Clock_In_Time__c = newClkInUserTz,
                        wfrecon__Clock_Out_Time__c = firstDayEnd,
                        wfrecon__Do_Not_Execute__c = true 
                    );
                    entriesToUpdate.add(entryToUpdate);
                    
                    // B. Insert New Entry (Day 2)
                    wfrecon__Timesheet_Entry__c newEntry = new wfrecon__Timesheet_Entry__c(
                        wfrecon__Timesheet__c = parentEntry.wfrecon__Timesheet__c,
                        wfrecon__Clock_In_Time__c = secondDayStart,
                        wfrecon__Clock_Out_Time__c = newClkOutUserTz,
                        wfrecon__Cost_Code__c = parentEntry.wfrecon__Cost_Code__c, 
                        wfrecon__Mobilization__c = parentEntry.wfrecon__Mobilization__c, // CRUCIAL for job linkage
                        wfrecon__Do_Not_Execute__c = true
                    );
                    entriesToInsert.add(newEntry);
                    
                    // Create New Item (Day 2) - No Travel Time or Per Diem on the second item
                    wfrecon__Timesheet_Entry_Item__c newItem = new wfrecon__Timesheet_Entry_Item__c(
                        wfrecon__Clock_In_Time__c = secondDayStart,
                        wfrecon__Clock_Out_Time__c = newClkOutUserTz,
                        wfrecon__Cost_Code__c = parentEntry.wfrecon__Cost_Code__c,
                        wfrecon__Travel_Time__c = 0.00, 
                        wfrecon__Per_Diem__c = 0,    
                        wfrecon__Premium__c = premium,
                        wfrecon__Do_Not_Execute__c = true
                    );
                    itemsToInsert.add(newItem);
                    newItemsCount++;
                    
                } else {
                    // --- Normal Same-Day Update ---
                    
                    // Update Item with new times
                    itemToUpdate.wfrecon__Clock_In_Time__c = newClkInUserTz;
                    itemToUpdate.wfrecon__Clock_Out_Time__c = newClkOutUserTz;
                    itemsToUpdate.add(itemToUpdate);
                    
                    // Update Parent TSE only if times changed
                    if (changes.containsKey('clockInTime') || changes.containsKey('clockOutTime')) {
                        
                        // FLS FIX applied here
                        entryToUpdate = new wfrecon__Timesheet_Entry__c(
                            Id = parentEntry.Id,
                            wfrecon__Clock_In_Time__c = newClkInUserTz,
                            wfrecon__Clock_Out_Time__c = newClkOutUserTz,
                            wfrecon__Do_Not_Execute__c = true 
                        );
                        entriesToUpdate.add(entryToUpdate);
                    }
                }
            }

            // 1. Update existing Parent Entries (TSE)
            if (!entriesToUpdate.isEmpty()) {
                Database.update(entriesToUpdate, AccessLevel.USER_MODE);
            }
            
            // 2. Update existing Items (TSELI)
            if (!itemsToUpdate.isEmpty()) {
                Database.update(itemsToUpdate, AccessLevel.USER_MODE);
            }
            
            // 3. Insert new Parent Entries (TSE) for split - USE ALLORNONE=FALSE FOR ERROR TRACING
            if (!entriesToInsert.isEmpty()) {
                Database.SaveResult[] results = Database.insert(entriesToInsert, false, AccessLevel.USER_MODE);
                
                Integer errorCount = 0;
                for (Database.SaveResult result : results) {
                    if (result.isSuccess()) {
                        // Collect successful inserts to link TSELI records later
                        insertedEntries.add(new wfrecon__Timesheet_Entry__c(Id = result.getId()));
                    } else {
                        errorCount++;
                        for (Database.Error err : result.getErrors()) {
                            if (err.getFields() != null) {
                                System.debug('Fields: ' + err.getFields());
                            }
                        }
                    }
                }
                
                if (errorCount > 0) {
                    throw new DmlException('Failed to insert ' + errorCount + ' Timesheet Entries during split. See logs for specific field/validation errors.');
                }

                // Link new Items (TSELI) to their newly created Parent Entry IDs
                for(Integer i = 0; i < insertedEntries.size(); i++) {
                    // Note: insertedEntries now holds only successful inserts, which must match the size/order of the successful itemsToInsert.
                    itemsToInsert[i].wfrecon__Timesheet_Entry__c = insertedEntries[i].Id;
                }
            }
            
            // 4. Insert new Items (TSELI) for split
            if (!itemsToInsert.isEmpty()) {
                // If the items are valid but the parent TSE failed, this DML will fail or roll back
                // We rely on the TSE insert handling (step 3) to prevent invalid data from reaching here.
                Database.insert(itemsToInsert, AccessLevel.USER_MODE);
            }

            return 'Success: ' + (itemsToUpdate.size() + newItemsCount) + ' total timesheet entry item(s) processed successfully.';

        } catch (Exception e) {
            if (e.getTypeName() == 'System.DmlException') {
                System.debug('DML Exception Details: ' + e.getDmlStatusCode(0) + ' - ' + e.getDmlMessage(0));
            }

            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'JobDetailsPageController',
                'methodName' => 'saveTimesheetEntryInlineEdits',
                'exceptionObj' => e,
                'moreDetails' => 'DML error during inline edit process.'
            });
            return 'Error: ' + e.getMessage();
        }
    }

   /*
    *********************************************************
    @description     : Method is used to delete multiple Timesheet Entry Items and their parent Timesheet Entries
    @param           : List<Id> tselIds - List of Timesheet Entry Item Ids (TSELI) to delete
    @return          : String - Success or error message
    ********************************************************
    */
    @AuraEnabled
    public static String deleteTimesheetEntriesBulk(List<Id> tselIds) {
        try {
            if (tselIds == null || tselIds.isEmpty()) {
                return 'Error: No timesheet entry items selected for deletion';
            }
            
            // 1. Fetch Timesheet Entry Items and their parent IDs
            List<wfrecon__Timesheet_Entry_Item__c> itemsToDelete = [
                SELECT Id, wfrecon__Timesheet_Entry__c
                FROM wfrecon__Timesheet_Entry_Item__c
                WHERE Id IN :tselIds
                WITH USER_MODE
            ];
            
            Set<Id> tsEntryIdsToConsider = new Set<Id>();
            for(wfrecon__Timesheet_Entry_Item__c item : itemsToDelete) {
                tsEntryIdsToConsider.add(item.wfrecon__Timesheet_Entry__c);
            }
            
            // 2. Determine which parent entries currently have EXACTLY ONE child item (TSELI)
            // If the parent only has 1 item, and we are deleting that item, we delete the parent.
            Set<Id> tsEntryIdsToFullyDelete = new Set<Id>();
            
            // Correct logic: Use Aggregate Query to find parents with COUNT(Id) = 1
            List<AggregateResult> parentItemCounts = [
                SELECT wfrecon__Timesheet_Entry__c parentId, COUNT(Id) itemTotal
                FROM wfrecon__Timesheet_Entry_Item__c
                WHERE wfrecon__Timesheet_Entry__c IN :tsEntryIdsToConsider
                WITH USER_MODE
                GROUP BY wfrecon__Timesheet_Entry__c
                HAVING COUNT(Id) = 1
            ];

            for (AggregateResult ar : parentItemCounts) {
                Id parentId = (Id) ar.get('parentId');
                tsEntryIdsToFullyDelete.add(parentId);
            }
            
            // 3. Fetch Timesheet Entries to delete
            List<wfrecon__Timesheet_Entry__c> entriesToDelete = [
                SELECT Id
                FROM wfrecon__Timesheet_Entry__c
                WHERE Id IN :tsEntryIdsToFullyDelete
                WITH USER_MODE
            ];
            
            // 4. Perform Deletion
            // Delete child items first
            delete as user itemsToDelete;
            
            // Delete parent entries that were found to have only one item before deletion
            if (!entriesToDelete.isEmpty()) {
                delete as user entriesToDelete;
            }

            return 'Success: ' + itemsToDelete.size() + ' timesheet entry item(s) and ' + entriesToDelete.size() + ' parent timesheet entry(s) deleted successfully';

        } catch (DmlException e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'JobDetailsPageController',
                'methodName' => 'deleteTimesheetEntriesBulk',
                'exceptionObj' => e,
                'moreDetails' => 'DML Error during bulk deletion.'
            });
            return 'Error: Deletion failed. Error: ' + e.getDmlMessage(0);
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobDetailsPageController', 'methodName' => 'deleteTimesheetEntriesBulk', 'exceptionObj' => e, 'moreDetails' => e.getMessage()});
            return 'Error: ' + e.getMessage();
        }
    }


    /*
    *********************************************************
    @description     : Method is used to delete timesheet record
    @param           : TSELId - {String} - id to delete timesheet record
    @return          : Boolean - Success or failure of the operation
    ********************************************************
    */
    @AuraEnabled
    public static Boolean deleteTimesheetEntry(String TSELId) {
        try {
            wfrecon__Timesheet_Entry_Item__c tsItem = [SELECT Id, wfrecon__Timesheet_Entry__c FROM wfrecon__Timesheet_Entry_Item__c WHERE Id = :TSELId WITH USER_MODE];

            wfrecon__Timesheet_Entry__c tsEntry = [SELECT Id, (SELECT Id FROM wfrecon__Timesheet_Entry_Items__r) FROM wfrecon__Timesheet_Entry__c WHERE Id = :tsItem.wfrecon__Timesheet_Entry__c WITH USER_MODE];

            // Only delete the parent entry if this is the last child item
            if (tsEntry.wfrecon__Timesheet_Entry_Items__r.size() == 1) {
                delete as user tsItem;
                delete as user tsEntry;
            } else {
                // If there are other items, just delete this item
                delete as user tsItem;
            }

            return true;
        } catch (Exception e) {
            System.debug('Exception in deleteTimesheetEntry: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobDetailsPageController', 'methodName' => 'deleteTimesheetEntry', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return false;
        }
    }

    /*
    *********************************************************
    @description     : Method is used to convert datetime string in UTC format to Datetime
    @param           : utcDateTimeStr - {String} - Datetime string in UTC format (e.g., '2023-10-05T14:30:00Z')
    @return          : Datetime - Converted Datetime object
    ********************************************************
    */
    public static Datetime convertUtc(String utcDateTimeStr) {
        try {
            if(String.isBlank(utcDateTimeStr)) return null;
    
            // Normalize string: if seconds missing, add ':00'
            if(!Pattern.matches('\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}', utcDateTimeStr)) {
                if(Pattern.matches('\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}', utcDateTimeStr)) {
                    utcDateTimeStr += ':00';
                } else {
                    // Invalid format
                    System.debug('Invalid datetime format: ' + utcDateTimeStr);
                }
            }
    
            // Replace T with space for DateTime.valueOf
            utcDateTimeStr = utcDateTimeStr.replace('T',' ');
    
            // Convert to Datetime (interpreted as GMT/UTC)
            Datetime utcDT = Datetime.valueOf(utcDateTimeStr);

            return utcDT;
        } catch (Exception e) {
            System.debug('Error in convertUtc: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobDetailsPageController', 'methodName' => 'convertUtc', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    public class MobilizationWrapper {
        @AuraEnabled public Id mobId { get; set; }
        @AuraEnabled public Id jobId { get; set; }
        @AuraEnabled public String jobNumber { get; set; }
        @AuraEnabled public String jobName { get; set; }
        @AuraEnabled public String jobAddress { get; set; }
        @AuraEnabled public String jobDescription { get; set; }
        @AuraEnabled public DateTime startDate { get; set; }
        @AuraEnabled public DateTime endDate { get; set; }
        // @AuraEnabled public String status { get; set; }
        @AuraEnabled public Decimal totalManHours { get; set; }
        @AuraEnabled public Decimal totalHoursWithTravel { get; set; }
        @AuraEnabled public Integer clockedInMembersCount { get; set; }
    }

    public class TimesheetEntryItemWrapper {
        @AuraEnabled public Id id; // Timesheet Entry Item ID (TSELI) or Timesheet Entry ID (TSE) for clock-in-only
        @AuraEnabled public Id TSEId; // Timesheet Entry ID (TSE)
        @AuraEnabled public String contactName;
        @AuraEnabled public Datetime clockInTime;
        @AuraEnabled public Datetime clockOutTime;
        @AuraEnabled public Decimal workHours;
        @AuraEnabled public Decimal travelTime;
        @AuraEnabled public Decimal perDiem;
        @AuraEnabled public Decimal totalTime;
        @AuraEnabled public Boolean premium;
        @AuraEnabled public String costCodeName;
        @AuraEnabled public Date clockInDate;
        @AuraEnabled public Id mobId; // Added for easy lookup/refresh
        @AuraEnabled public Id timesheetId; // Added for easy lookup/refresh
        @AuraEnabled public Boolean isClockInOnly; // Flag to identify clock-in-only entries (non-editable)

        // Constructor for complete entries (TSELI)
        public TimesheetEntryItemWrapper(wfrecon__Timesheet_Entry_Item__c item) {
            this.id = item.Id;
            this.TSEId = item.wfrecon__Timesheet_Entry__c; // Expose parent ID
            this.contactName = item.wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Contact__r.Name;
            
            // Convert to user timezone
            this.clockInTime  = item.wfrecon__Clock_In_Time__c  != null ? item.wfrecon__Clock_In_Time__c.addSeconds(userTz.getOffset(item.wfrecon__Clock_In_Time__c)/1000)  : null;
            this.clockOutTime = item.wfrecon__Clock_Out_Time__c != null ? item.wfrecon__Clock_Out_Time__c.addSeconds(userTz.getOffset(item.wfrecon__Clock_Out_Time__c)/1000) : null;

            this.travelTime = item.wfrecon__Travel_Time__c != null ? item.wfrecon__Travel_Time__c : 0.00;
            this.perDiem = item.wfrecon__Per_Diem__c != null ? item.wfrecon__Per_Diem__c : 0;
            this.workHours = item.wfrecon__Total_Time__c != null ? item.wfrecon__Total_Time__c : 0.00;
            this.totalTime = this.workHours + this.travelTime;
            this.costCodeName = item.wfrecon__Cost_Code__r != null ? item.wfrecon__Cost_Code__r.Name : '-';
            this.premium = item.wfrecon__Premium__c;
            this.clockInDate = item.wfrecon__Clock_In_Date__c;
            this.mobId = item.wfrecon__Timesheet_Entry__r.wfrecon__Mobilization__c;
            this.timesheetId = item.wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__c;
            this.isClockInOnly = false; // Complete entry
        }

        // Constructor for clock-in-only entries (TSE)
        public TimesheetEntryItemWrapper(wfrecon__Timesheet_Entry__c entry) {
            this.id = entry.Id; // For clock-in-only, id is the TSE Id
            this.TSEId = entry.Id; // Same as id for clock-in-only
            this.contactName = entry.wfrecon__TimeSheet__r.wfrecon__Contact__r.Name;
            
            // Convert to user timezone
            this.clockInTime = entry.wfrecon__Clock_In_Time__c != null ? entry.wfrecon__Clock_In_Time__c.addSeconds(userTz.getOffset(entry.wfrecon__Clock_In_Time__c)/1000) : null;
            this.clockOutTime = null; // No clock-out yet
            
            // Set all other fields as null/0 for display as '--'
            this.workHours = null;
            this.travelTime = null;
            this.perDiem = null;
            this.totalTime = null;
            this.premium = null;
            this.costCodeName = entry.wfrecon__Cost_Code__r != null ? entry.wfrecon__Cost_Code__r.Name : '-';
            this.clockInDate = entry.wfrecon__Clock_In_Date__c;
            this.mobId = entry.wfrecon__Mobilization__c;
            this.timesheetId = entry.wfrecon__TimeSheet__c;
            this.isClockInOnly = true; // Mark as clock-in-only (non-editable)
        }
    }

    public class WrapperMember {
        @AuraEnabled public Id contactId;
        @AuraEnabled public String contactName;
        @AuraEnabled public DateTime jobStartTime;
        @AuraEnabled public DateTime jobEndTime;
        @AuraEnabled public DateTime clockInTime;
        @AuraEnabled public Boolean isTimesheetNull;
        @AuraEnabled public String timesheetId;
        @AuraEnabled public Boolean isTimesheetEntryNull;
        @AuraEnabled public String timesheetEntryId;
        @AuraEnabled public String mobMemberId;
        @AuraEnabled public Map<Id, String> costCodeDetails;
        @AuraEnabled public Boolean isAgain;
        @AuraEnabled public String crewName;
        @AuraEnabled public DateTime recentClockIn;
        @AuraEnabled public DateTime recentClockOut;
    }
}