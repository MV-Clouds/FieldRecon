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
            List<wfrecon__Timesheet_Entry_Item__c> items = [
                SELECT Id, wfrecon__Timesheet_Entry__c, wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Contact__r.Name, 
                       wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Travel_Time__c, wfrecon__Per_Diem__c, wfrecon__Total_Time__c, 
                       wfrecon__Cost_Code__r.Name, wfrecon__Clock_In_Date__c, wfrecon__Clock_Out_Date__c, wfrecon__Premium__c
                FROM wfrecon__Timesheet_Entry_Item__c 
                 WHERE wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Job__c = :jobId
                  AND wfrecon__Clock_In_Date__c >= :jobStartDate
                  AND wfrecon__Clock_Out_Date__c <= :jobEndDate
                WITH USER_MODE
                ORDER BY wfrecon__Clock_In_Time__c ASC
            ];

            List<TimesheetEntryItemWrapper> result = new List<TimesheetEntryItemWrapper>();
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
                DateTime mostRecentClockIn;
                DateTime mostRecentClockOut;
    
                for (wfrecon__Timesheet_Entry__c e : userEntries) {
                    // Track most recent clock in/out times
                    if (e.wfrecon__Clock_In_Time__c != null) {
                        if (mostRecentClockIn == null || e.wfrecon__Clock_In_Time__c > mostRecentClockIn) {
                            mostRecentClockIn = e.wfrecon__Clock_In_Time__c;
                        }
                    }
                    if (e.wfrecon__Clock_Out_Time__c != null) {
                        if (mostRecentClockOut == null || e.wfrecon__Clock_Out_Time__c > mostRecentClockOut) {
                            mostRecentClockOut = e.wfrecon__Clock_Out_Time__c;
                        }
                    }
                    
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
                    insert timesheetEntryRec;
                } else {
                    List<wfrecon__Timesheet__c> timesheetRecs = [SELECT Id FROM wfrecon__Timesheet__c WHERE Id = :(String)paramsMap.get('timesheetId') WITH USER_MODE];
                    
                    wfrecon__Timesheet_Entry__c timesheetEntryRec = new wfrecon__Timesheet_Entry__c();
                    timesheetEntryRec.wfrecon__Timesheet__c = timesheetRecs[0].Id;
                    timesheetEntryRec.wfrecon__Clock_In_Time__c = clkInUserTz;
                    timesheetEntryRec.wfrecon__Cost_Code__c = (String)paramsMap.get('costCodeId');
                    timesheetEntryRec.wfrecon__Mobilization__c = mobId;
                    timesheetEntryRec.wfrecon__Do_Not_Execute__c = true;
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
                                insert entryDay1;

                                wfrecon__Timesheet_Entry_Item__c itemDay1 = new wfrecon__Timesheet_Entry_Item__c(
                                    wfrecon__Timesheet_Entry__c = entryDay1.Id,
                                    wfrecon__Clock_In_Time__c = entryDay1.wfrecon__Clock_In_Time__c,
                                    wfrecon__Clock_Out_Time__c = entryDay1.wfrecon__Clock_Out_Time__c,
                                    wfrecon__Do_Not_Execute__c = true
                                );
                                insert itemDay1;

                                // 2️⃣ Entry for Day 2 (from 12:00 AM)
                                wfrecon__Timesheet_Entry__c entryDay2 = new wfrecon__Timesheet_Entry__c(
                                    wfrecon__Timesheet__c = tsId,
                                    wfrecon__Clock_In_Time__c = secondDayStart,
                                    wfrecon__Clock_Out_Time__c = clkOutUserTz,
                                    wfrecon__Mobilization__c = mobId,
                                    wfrecon__Do_Not_Execute__c = true
                                );
                                insert entryDay2;

                                wfrecon__Timesheet_Entry_Item__c itemDay2 = new wfrecon__Timesheet_Entry_Item__c(
                                    wfrecon__Timesheet_Entry__c = entryDay2.Id,
                                    wfrecon__Clock_In_Time__c = entryDay2.wfrecon__Clock_In_Time__c,
                                    wfrecon__Clock_Out_Time__c = entryDay2.wfrecon__Clock_Out_Time__c,
                                    wfrecon__Do_Not_Execute__c = true
                                );
                                insert itemDay2;

                            } else {
                                wfrecon__Timesheet_Entry__c timesheetEntryRec = new wfrecon__Timesheet_Entry__c();
                                timesheetEntryRec.wfrecon__Timesheet__c = timesheetRecs[0].Id;
                                timesheetEntryRec.wfrecon__Clock_In_Time__c = clkInUserTz;
                                timesheetEntryRec.wfrecon__Clock_Out_Time__c = clkOutUserTz;
                                timesheetEntryRec.wfrecon__Mobilization__c = mobId;
                                timesheetEntryRec.wfrecon__Do_Not_Execute__c = true;
                                insert timesheetEntryRec;
        
                                wfrecon__Timesheet_Entry_Item__c timesheetEntryItemRec = new wfrecon__Timesheet_Entry_Item__c();
                                timesheetEntryItemRec.wfrecon__Timesheet_Entry__c = timesheetEntryRec.Id;
                                timesheetEntryItemRec.wfrecon__Clock_In_Time__c = timesheetEntryRec.wfrecon__Clock_In_Time__c;
                                timesheetEntryItemRec.wfrecon__Clock_Out_Time__c = timesheetEntryRec.wfrecon__Clock_Out_Time__c;
                                timesheetEntryItemRec.wfrecon__Cost_Code__c = timesheetEntryRec.wfrecon__Cost_Code__c;
                                timesheetEntryItemRec.wfrecon__Do_Not_Execute__c = true;
                                insert timesheetEntryItemRec;
                            }
                        }
                    }
                } else {
                    List<wfrecon__Timesheet_Entry__c> timesheetEntryRecs = [SELECT Id, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Cost_Code__c, wfrecon__Timesheet__c FROM wfrecon__Timesheet_Entry__c WHERE Id = :(String)paramsMap.get('timesheetEntryId') WITH USER_MODE];
                    if (!timesheetEntryRecs.isEmpty()) {
                        wfrecon__Timesheet_Entry__c existing = timesheetEntryRecs[0];
                        Boolean crossesMidnightExisting = (existing.wfrecon__Clock_In_Time__c.date() != clkOutUserTz.date());

                        if (crossesMidnightExisting) {
                            Datetime firstDayEnd = DateTime.newInstance(existing.wfrecon__Clock_In_Time__c.date(), Time.newInstance(23, 59, 59, 999));
                            Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));

                            // Update existing entry to end at 11:59 PM
                            existing.wfrecon__Clock_Out_Time__c = firstDayEnd;
                            update existing;

                            // Create Timesheet Entry Item for day 1
                            wfrecon__Timesheet_Entry_Item__c itemDay1 = new wfrecon__Timesheet_Entry_Item__c(
                                wfrecon__Timesheet_Entry__c = existing.Id,
                                wfrecon__Clock_In_Time__c = existing.wfrecon__Clock_In_Time__c,
                                wfrecon__Clock_Out_Time__c = existing.wfrecon__Clock_Out_Time__c,
                                wfrecon__Cost_Code__c = existing.wfrecon__Cost_Code__c,
                                wfrecon__Do_Not_Execute__c = true
                            );
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
                            insert entryDay2;

                            // Create Timesheet Entry Item for day 2
                            wfrecon__Timesheet_Entry_Item__c itemDay2 = new wfrecon__Timesheet_Entry_Item__c(
                                wfrecon__Timesheet_Entry__c = entryDay2.Id,
                                wfrecon__Clock_In_Time__c = entryDay2.wfrecon__Clock_In_Time__c,
                                wfrecon__Clock_Out_Time__c = entryDay2.wfrecon__Clock_Out_Time__c,
                                wfrecon__Cost_Code__c = entryDay2.wfrecon__Cost_Code__c,
                                wfrecon__Do_Not_Execute__c = true
                            );
                            insert itemDay2;
                        } else {
                            // Normal same-day update
                            existing.wfrecon__Clock_Out_Time__c = clkOutUserTz;
                            update existing;

                            wfrecon__Timesheet_Entry_Item__c item = new wfrecon__Timesheet_Entry_Item__c(
                                wfrecon__Timesheet_Entry__c = existing.Id,
                                wfrecon__Clock_In_Time__c = existing.wfrecon__Clock_In_Time__c,
                                wfrecon__Clock_Out_Time__c = existing.wfrecon__Clock_Out_Time__c,
                                wfrecon__Cost_Code__c = existing.wfrecon__Cost_Code__c,
                                wfrecon__Do_Not_Execute__c = true
                            );
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
                insert timesheetRec;

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
                insert entryDay1;

                wfrecon__Timesheet_Entry_Item__c itemDay1 = new wfrecon__Timesheet_Entry_Item__c(
                    wfrecon__Timesheet_Entry__c = entryDay1.Id,
                    wfrecon__Clock_In_Time__c = clkInUserTz,
                    wfrecon__Clock_Out_Time__c = firstDayEnd,
                    wfrecon__Cost_Code__c = costCodeId,
                    wfrecon__Travel_Time__c = travelTime,
                    wfrecon__Per_Diem__c = perDiem,
                    wfrecon__Do_Not_Execute__c = true
                );
                insert itemDay1;

                // Entry for day 2
                wfrecon__Timesheet_Entry__c entryDay2 = new wfrecon__Timesheet_Entry__c(
                    wfrecon__Timesheet__c = tsRec.Id,
                    wfrecon__Clock_In_Time__c = secondDayStart,
                    wfrecon__Clock_Out_Time__c = clkOutUserTz,
                    wfrecon__Cost_Code__c = costCodeId,
                    wfrecon__Mobilization__c = mobId,
                    wfrecon__Do_Not_Execute__c = true
                );
                insert entryDay2;

                wfrecon__Timesheet_Entry_Item__c itemDay2 = new wfrecon__Timesheet_Entry_Item__c(
                    wfrecon__Timesheet_Entry__c = entryDay2.Id,
                    wfrecon__Clock_In_Time__c = secondDayStart,
                    wfrecon__Clock_Out_Time__c = clkOutUserTz,
                    wfrecon__Cost_Code__c = costCodeId,
                    wfrecon__Do_Not_Execute__c = true
                );
                insert itemDay2;
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
    @description     : Method is used to update timesheet records
    @param           : params - {String} - Parameters to create timesheet records
    @return          : Boolean - Success or failure of the operation
    ********************************************************
    */
    @AuraEnabled
    public static Boolean updateTimesheets(String params){
        try {
            System.debug(params);
            Map<String, Object> jsonList = (Map<String, Object>) JSON.deserializeUntyped(params);
            System.debug(jsonList);

            // Query records
            wfrecon__Timesheet_Entry_Item__c tsItem = [
                SELECT Id, wfrecon__Travel_Time__c, wfrecon__Per_Diem__c, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Premium__c 
                FROM wfrecon__Timesheet_Entry_Item__c 
                WHERE Id = :(String)jsonList.get('Id')
                WITH USER_MODE
                LIMIT 1
            ];

            wfrecon__Timesheet_Entry__c tsEntry = [
                SELECT Id, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Timesheet__c, wfrecon__Cost_Code__c 
                FROM wfrecon__Timesheet_Entry__c 
                WHERE Id = :(String)jsonList.get('TSEId')
                WITH USER_MODE
                LIMIT 1
            ];

            // Convert clock-in and clock-out strings to Datetime
            Datetime clkInUserTz = convertUtc((String)jsonList.get('ClockIn'));
            Datetime clkOutUserTz = convertUtc((String)jsonList.get('ClockOut'));

            Decimal travelTime = Decimal.valueOf((String)jsonList.get('TravelTime'));
            Integer perDiem = Integer.valueOf((String)jsonList.get('PerDiem'));
            Boolean premium = Boolean.valueOf((String)jsonList.get('premium'));
            
            Boolean crossesMidnight = (clkInUserTz.date() != clkOutUserTz.date());

            if (crossesMidnight) {
                Datetime firstDayEnd = DateTime.newInstance(clkInUserTz.date(), Time.newInstance(23, 59, 59, 999));
                Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));

                // Update current entry to end day 1
                tsEntry.wfrecon__Clock_In_Time__c = clkInUserTz;
                tsEntry.wfrecon__Clock_Out_Time__c = firstDayEnd;
                update tsEntry;

                tsItem.wfrecon__Clock_In_Time__c = clkInUserTz;
                tsItem.wfrecon__Clock_Out_Time__c = firstDayEnd;
                tsItem.wfrecon__Travel_Time__c = travelTime;
                tsItem.wfrecon__Per_Diem__c = perDiem;
                tsItem.wfrecon__Premium__c = premium;
                update tsItem;

                // Create new entry for day 2
                wfrecon__Timesheet_Entry__c entryDay2 = new wfrecon__Timesheet_Entry__c(
                    wfrecon__Timesheet__c = tsEntry.wfrecon__Timesheet__c,
                    wfrecon__Clock_In_Time__c = secondDayStart,
                    wfrecon__Clock_Out_Time__c = clkOutUserTz,
                    wfrecon__Cost_Code__c = tsEntry.wfrecon__Cost_Code__c,
                    wfrecon__Do_Not_Execute__c = true
                );
                insert entryDay2;

                wfrecon__Timesheet_Entry_Item__c itemDay2 = new wfrecon__Timesheet_Entry_Item__c(
                    wfrecon__Timesheet_Entry__c = entryDay2.Id,
                    wfrecon__Clock_In_Time__c = secondDayStart,
                    wfrecon__Clock_Out_Time__c = clkOutUserTz,
                    wfrecon__Cost_Code__c = tsEntry.wfrecon__Cost_Code__c,
                    wfrecon__Do_Not_Execute__c = true
                );
                insert itemDay2;
            } else {
                // Normal same-day update
                tsItem.wfrecon__Clock_In_Time__c = clkInUserTz;
                tsItem.wfrecon__Clock_Out_Time__c = clkOutUserTz;
                tsItem.wfrecon__Travel_Time__c = travelTime;
                tsItem.wfrecon__Per_Diem__c = perDiem;
                tsItem.wfrecon__Premium__c = premium;
                update tsItem;

                tsEntry.wfrecon__Clock_In_Time__c = clkInUserTz;
                tsEntry.wfrecon__Clock_Out_Time__c = clkOutUserTz;
                update tsEntry;
            }

            return true;
        } catch (Exception e) {
            System.debug('Exception in updateTimesheets: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobDetailsPageController', 'methodName' => 'updateTimesheets', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return false;
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
            wfrecon__Timesheet_Entry_Item__c tsItem = [SELECT Id, wfrecon__Timesheet_Entry__c FROM wfrecon__Timesheet_Entry_Item__c WHERE Id = :TSELId];

            wfrecon__Timesheet_Entry__c tsEntry = [SELECT Id FROM wfrecon__Timesheet_Entry__c WHERE Id = :tsItem.wfrecon__Timesheet_Entry__c];

            delete tsItem;
            delete tsEntry;

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
    }

    public class TimesheetEntryItemWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public Id TSEId;
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

        public TimesheetEntryItemWrapper(wfrecon__Timesheet_Entry_Item__c item) {
            this.id = item.Id;
            this.TSEId = item.wfrecon__Timesheet_Entry__c;
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