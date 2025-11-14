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
            List<Mobilization__c> mobs = [
                SELECT Id, Job__c, Job__r.Id, Start_Date__c, End_Date__c, Mobilization_Status__c, 
                    Job__r.Name, Job__r.Job_Name__c, Job__r.Address__c, Job__r.Description__c, Job__r.Status__c
                FROM Mobilization__c
                WHERE Start_Date__c >= :startOfDay 
                AND Start_Date__c <= :endOfDay 
                WITH USER_MODE
                ORDER BY Start_Date__c ASC
            ];

            if (mobs.isEmpty()) return new List<MobilizationWrapper>();

            // 1. Build a Map of JobId → List of mobilization start dates
            Map<Id, Set<Date>> jobDateMap = new Map<Id, Set<Date>>();
            for(Mobilization__c m : mobs) {
                if(m.Job__c != null && m.Start_Date__c != null) {
                    if(!jobDateMap.containsKey(m.Job__c)) {
                        jobDateMap.put(m.Job__c, new Set<Date>());
                    }
                    jobDateMap.get(m.Job__c).add(m.Start_Date__c.date());
                }
            }

            // 2. Aggregate total hours for relevant Job + Dates
            Map<String, Decimal> mobManHoursMap = new Map<String, Decimal>();
            Map<String, Decimal> mobTotalHoursWithTravelMap = new Map<String, Decimal>();
            for (AggregateResult ar : [
                SELECT Timesheet_Entry__r.TimeSheet__r.Job__c jobId,
                    Clock_In_Date__c workDate,
                    SUM(Total_Time__c) totalHours,
                    SUM(Travel_Time__c) travelTime
                FROM Timesheet_Entry_Item__c
                WHERE Timesheet_Entry__r.TimeSheet__r.Job__c IN :jobDateMap.keySet()
                AND Clock_In_Date__c != null
                WITH USER_MODE
                GROUP BY Timesheet_Entry__r.TimeSheet__r.Job__c, Clock_In_Date__c
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
            for (Mobilization__c m : mobs) {
                MobilizationWrapper w = new MobilizationWrapper();
                w.mobId = m.Id;
                w.jobId = m.Job__c;
                w.jobNumber = m.Job__r.Name;
                w.jobName = m.Job__r.Job_Name__c != null ? m.Job__r.Job_Name__c : '--';
                w.jobAddress = m.Job__r.Address__c != null ? m.Job__r.Address__c : '--';
                w.jobDescription = m.Job__r.Description__c != null ? m.Job__r.Description__c : '--';
                w.startDate = m.Start_Date__c.addSeconds(userTz.getOffset(m.Start_Date__c)/1000);
                w.endDate = m.End_Date__c.addSeconds(userTz.getOffset(m.End_Date__c)/1000);
                // w.startDate = m.Start_Date__c;
                // w.endDate = m.End_Date__c;
                // w.status = m.Job__r.Status__c != null ? m.Job__r.Status__c : '--';

                // Lookup hours
                String key = m.Job__c + '_' + String.valueOf(m.Start_Date__c.date());
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
            List<Timesheet_Entry_Item__c> items = [
                SELECT Id, Timesheet_Entry__c, Timesheet_Entry__r.TimeSheet__r.Contact__r.Name, 
                       Clock_In_Time__c, Clock_Out_Time__c, Travel_Time__c, Per_Diem__c, Total_Time__c, 
                       Cost_Code__r.Name, Clock_In_Date__c, Clock_Out_Date__c, Premium__c
                FROM Timesheet_Entry_Item__c 
                 WHERE Timesheet_Entry__r.TimeSheet__r.Job__c = :jobId
                  AND Clock_In_Date__c >= :jobStartDate
                  AND Clock_Out_Date__c <= :jobEndDate
                WITH USER_MODE
                ORDER BY Clock_In_Time__c ASC
            ];

            List<TimesheetEntryItemWrapper> result = new List<TimesheetEntryItemWrapper>();
            for(Timesheet_Entry_Item__c item : items) {
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
    
            List<Mobilization__c> mobilizationRecord = [
                SELECT Id, Job__c, Start_Date__c, End_Date__c
                FROM Mobilization__c
                WHERE Id = :mobId 
                WITH USER_MODE
                LIMIT 1
            ];
            System.debug('mobilizationRecord.size() ::' + mobilizationRecord.size());
    
            // 1. Fetch Members
            List<Mobilization_Member__c> members = [
                SELECT Id, Contact__c, Contact__r.Name, Contact__r.RecordType.DeveloperName, Contact__r.Can_Clock_In_Out__c, Mobilization__r.Job__c
                FROM Mobilization_Member__c
                WHERE Mobilization__c = :mobId
                AND Contact__c != null
                AND (Contact__r.RecordType.DeveloperName IN ('Employee_WF_Recon','Sub_Contractor_WF_Recon'))
                AND Contact__r.Can_Clock_In_Out__c = true
                WITH USER_MODE
            ];
            System.debug('members.size() ::' + members.size());
    
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
                WITH USER_MODE
            ];
            System.debug('tsList: ' + tsList.size());
            Map<Id, Timesheet__c> contactTimesheetMap = new Map<Id, Timesheet__c>();
            for (Timesheet__c ts : tsList) {
                System.debug('ts.Ids: ' + ts.Id);
                contactTimesheetMap.put(ts.Contact__c, ts);
            }
    
            // 3. Fetch Entries for those timesheets for that date
            Date startDate = mobilizationRecord[0].Start_Date__c.date(); // extract only date part
            Date endDate = mobilizationRecord[0].End_Date__c.date();     // extract only date part
            List<Timesheet_Entry__c> entries = [
                SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Timesheet__r.Contact__c
                FROM Timesheet_Entry__c
                WHERE Timesheet__c IN :tsList
                AND (Clock_In_Time__c >= :startDate
                OR Clock_In_Time__c <= :endDate.addDays(1))
                WITH USER_MODE
            ];
            System.debug('entries: ' + entries.size());
            
            // Group entries by Contact
            Map<Id, List<Timesheet_Entry__c>> contactEntriesMap = new Map<Id, List<Timesheet_Entry__c>>();
            for (Timesheet_Entry__c e : entries) {
                if (!contactEntriesMap.containsKey(e.Timesheet__r.Contact__c)) {
                    contactEntriesMap.put(e.Timesheet__r.Contact__c, new List<Timesheet_Entry__c>());
                }
                contactEntriesMap.get(e.Timesheet__r.Contact__c).add(e);
            }
            System.debug('contactEntriesMap: ' + contactEntriesMap);
    
            // 4. Build wrapper list
            for (Mobilization_Member__c m : members) {
                WrapperMember wrap = new WrapperMember();
                wrap.jobStartTime = mobilizationRecord[0].Start_Date__c.addSeconds(userTz.getOffset(mobilizationRecord[0].Start_Date__c)/1000);
                wrap.jobEndTime = mobilizationRecord[0].End_Date__c.addSeconds(userTz.getOffset(mobilizationRecord[0].End_Date__c)/1000);
                wrap.contactId = m.Contact__c;
                wrap.contactName = m.Contact__r.Name;
                wrap.mobMemberId = m.Id;
    
                Timesheet__c ts = contactTimesheetMap.get(m.Contact__c);
                List<Timesheet_Entry__c> userEntries = contactEntriesMap.get(m.Contact__c);
    
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
                Timesheet_Entry__c latestOpen;
                Timesheet_Entry__c latestCompleted;
                DateTime mostRecentClockIn;
                DateTime mostRecentClockOut;
    
                for (Timesheet_Entry__c e : userEntries) {
                    // Track most recent clock in/out times
                    if (e.Clock_In_Time__c != null) {
                        if (mostRecentClockIn == null || e.Clock_In_Time__c > mostRecentClockIn) {
                            mostRecentClockIn = e.Clock_In_Time__c;
                        }
                    }
                    if (e.Clock_Out_Time__c != null) {
                        if (mostRecentClockOut == null || e.Clock_Out_Time__c > mostRecentClockOut) {
                            mostRecentClockOut = e.Clock_Out_Time__c;
                        }
                    }
                    
                    if (e.Clock_In_Time__c != null && e.Clock_Out_Time__c == null) {
                        hasOpenEntry = true;
                        latestOpen = e;
                    } else if (e.Clock_In_Time__c != null && e.Clock_Out_Time__c != null) {
                        hasCompletedEntry = true;
                        latestCompleted = e;
                    } else if (e.Clock_In_Time__c == null && e.Clock_Out_Time__c != null) {
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
                    wrap.clockInTime = (latestOpen.Clock_In_Time__c != null)
                        ? latestOpen.Clock_In_Time__c.addSeconds(userTz.getOffset(latestOpen.Clock_In_Time__c)/1000)
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
            List<Cost_Code__c> costCodeRecs = [SELECT Id, Name FROM Cost_Code__c WITH USER_MODE];
            for (Cost_Code__c c : costCodeRecs) {
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
            List<Mobilization__c> mobRec = [
                SELECT Id, Name, Mobilization_Group__r.Start_Date__c, Mobilization_Group__r.End_Date__c 
                FROM Mobilization__c 
                WHERE Id = :mobId
                WITH USER_MODE
            ];
            mobGroupId = mobRec[0].Mobilization_Group__r.Id;
            
            List<Mobilization_Member__c> mobMemberRecs = [SELECT Id, Contact__c, Mobilization__r.Mobilization_Group__r.Start_Date__c, Mobilization__r.Mobilization_Group__r.End_Date__c FROM Mobilization_Member__c WHERE Id = :(String)paramsMap.get('mobMemberId') WITH USER_MODE];

            if((String) paramsMap.get('actionType') == 'clockIn') {
                
                // Convert clockInTime to UTC to user timezone
                String clockInTimeString = (String)paramsMap.get('clockInTime');
                Datetime clkInUserTz = convertUtc(clockInTimeString);

                // If first clockin for moblization group for contact > Create Timesheet and Timesheet Entry
                if(paramsMap.get('isTimeSheetNull') == true) {
                    Timesheet__c timesheetRec = new Timesheet__c();
                    timesheetRec.Contact__c = mobMemberRecs[0].Contact__c;
                    timesheetRec.Job__c = jobId;
                    timesheetRec.Timesheet_Start_Date__c = mobMemberRecs[0].Mobilization__r.Mobilization_Group__r.Start_Date__c.date();
                    timesheetRec.Timesheet_End_Date__c = mobMemberRecs[0].Mobilization__r.Mobilization_Group__r.End_Date__c.date();
                    timesheetRec.Mobilization_Group__c = mobGroupId;
                    timesheetRec.Do_Not_Execute__c = true;
                    insert timesheetRec;
    
                    Timesheet_Entry__c timesheetEntryRec = new Timesheet_Entry__c();
                    timesheetEntryRec.Timesheet__c = timesheetRec.Id;
                    timesheetEntryRec.Clock_In_Time__c = clkInUserTz;
                    timesheetEntryRec.Cost_Code__c = (String)paramsMap.get('costCodeId');
                    timesheetEntryRec.Mobilization__c = mobId;
                    timesheetEntryRec.Do_Not_Execute__c = true;
                    insert timesheetEntryRec;
                } else {
                    List<Timesheet__c> timesheetRecs = [SELECT Id FROM Timesheet__c WHERE Id = :(String)paramsMap.get('timesheetId') WITH USER_MODE];
                    
                    Timesheet_Entry__c timesheetEntryRec = new Timesheet_Entry__c();
                    timesheetEntryRec.Timesheet__c = timesheetRecs[0].Id;
                    timesheetEntryRec.Clock_In_Time__c = clkInUserTz;
                    timesheetEntryRec.Cost_Code__c = (String)paramsMap.get('costCodeId');
                    timesheetEntryRec.Mobilization__c = mobId;
                    timesheetEntryRec.Do_Not_Execute__c = true;
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
                        List<Timesheet__c> timesheetRecs = [SELECT Id FROM Timesheet__c WHERE Id = :(String)paramsMap.get('timesheetId') WITH USER_MODE];

                        if (!timesheetRecs.isEmpty()) {
                            Id tsId = timesheetRecs[0].Id;
                            
                            if (crossesMidnight) {
                                // 🕛 Split Entry Across Two Days
                                Datetime firstDayEnd = DateTime.newInstance(clkInUserTz.date(), Time.newInstance(23, 59, 59, 999));
                                Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));

                                // 1️⃣ Entry for Day 1 (till 11:59 PM)
                                Timesheet_Entry__c entryDay1 = new Timesheet_Entry__c(
                                    Timesheet__c = tsId,
                                    Clock_In_Time__c = clkInUserTz,
                                    Clock_Out_Time__c = firstDayEnd,
                                    Mobilization__c = mobId,
                                    Do_Not_Execute__c = true
                                );
                                insert entryDay1;

                                Timesheet_Entry_Item__c itemDay1 = new Timesheet_Entry_Item__c(
                                    Timesheet_Entry__c = entryDay1.Id,
                                    Clock_In_Time__c = entryDay1.Clock_In_Time__c,
                                    Clock_Out_Time__c = entryDay1.Clock_Out_Time__c,
                                    Do_Not_Execute__c = true
                                );
                                insert itemDay1;

                                // 2️⃣ Entry for Day 2 (from 12:00 AM)
                                Timesheet_Entry__c entryDay2 = new Timesheet_Entry__c(
                                    Timesheet__c = tsId,
                                    Clock_In_Time__c = secondDayStart,
                                    Clock_Out_Time__c = clkOutUserTz,
                                    Mobilization__c = mobId,
                                    Do_Not_Execute__c = true
                                );
                                insert entryDay2;

                                Timesheet_Entry_Item__c itemDay2 = new Timesheet_Entry_Item__c(
                                    Timesheet_Entry__c = entryDay2.Id,
                                    Clock_In_Time__c = entryDay2.Clock_In_Time__c,
                                    Clock_Out_Time__c = entryDay2.Clock_Out_Time__c,
                                    Do_Not_Execute__c = true
                                );
                                insert itemDay2;

                            } else {
                                Timesheet_Entry__c timesheetEntryRec = new Timesheet_Entry__c();
                                timesheetEntryRec.Timesheet__c = timesheetRecs[0].Id;
                                timesheetEntryRec.Clock_In_Time__c = clkInUserTz;
                                timesheetEntryRec.Clock_Out_Time__c = clkOutUserTz;
                                timesheetEntryRec.Mobilization__c = mobId;
                                timesheetEntryRec.Do_Not_Execute__c = true;
                                insert timesheetEntryRec;
        
                                Timesheet_Entry_Item__c timesheetEntryItemRec = new Timesheet_Entry_Item__c();
                                timesheetEntryItemRec.Timesheet_Entry__c = timesheetEntryRec.Id;
                                timesheetEntryItemRec.Clock_In_Time__c = timesheetEntryRec.Clock_In_Time__c;
                                timesheetEntryItemRec.Clock_Out_Time__c = timesheetEntryRec.Clock_Out_Time__c;
                                timesheetEntryItemRec.Cost_Code__c = timesheetEntryRec.Cost_Code__c;
                                timesheetEntryItemRec.Do_Not_Execute__c = true;
                                insert timesheetEntryItemRec;
                            }
                        }
                    }
                } else {
                    List<Timesheet_Entry__c> timesheetEntryRecs = [SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Cost_Code__c, Timesheet__c FROM Timesheet_Entry__c WHERE Id = :(String)paramsMap.get('timesheetEntryId') WITH USER_MODE];
                    if (!timesheetEntryRecs.isEmpty()) {
                        Timesheet_Entry__c existing = timesheetEntryRecs[0];
                        Boolean crossesMidnightExisting = (existing.Clock_In_Time__c.date() != clkOutUserTz.date());

                        if (crossesMidnightExisting) {
                            Datetime firstDayEnd = DateTime.newInstance(existing.Clock_In_Time__c.date(), Time.newInstance(23, 59, 59, 999));
                            Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));

                            // Update existing entry to end at 11:59 PM
                            existing.Clock_Out_Time__c = firstDayEnd;
                            update existing;

                            // Create Timesheet Entry Item for day 1
                            Timesheet_Entry_Item__c itemDay1 = new Timesheet_Entry_Item__c(
                                Timesheet_Entry__c = existing.Id,
                                Clock_In_Time__c = existing.Clock_In_Time__c,
                                Clock_Out_Time__c = existing.Clock_Out_Time__c,
                                Cost_Code__c = existing.Cost_Code__c,
                                Do_Not_Execute__c = true
                            );
                            insert itemDay1;

                            // Create new entry for next day
                            Timesheet_Entry__c entryDay2 = new Timesheet_Entry__c(
                                Timesheet__c = existing.Timesheet__c,
                                Clock_In_Time__c = secondDayStart,
                                Clock_Out_Time__c = clkOutUserTz,
                                Cost_Code__c = existing.Cost_Code__c,
                                Mobilization__c = mobId,
                                Do_Not_Execute__c = true
                            );
                            insert entryDay2;

                            // Create Timesheet Entry Item for day 2
                            Timesheet_Entry_Item__c itemDay2 = new Timesheet_Entry_Item__c(
                                Timesheet_Entry__c = entryDay2.Id,
                                Clock_In_Time__c = entryDay2.Clock_In_Time__c,
                                Clock_Out_Time__c = entryDay2.Clock_Out_Time__c,
                                Cost_Code__c = entryDay2.Cost_Code__c,
                                Do_Not_Execute__c = true
                            );
                            insert itemDay2;
                        } else {
                            // Normal same-day update
                            existing.Clock_Out_Time__c = clkOutUserTz;
                            update existing;

                            Timesheet_Entry_Item__c item = new Timesheet_Entry_Item__c(
                                Timesheet_Entry__c = existing.Id,
                                Clock_In_Time__c = existing.Clock_In_Time__c,
                                Clock_Out_Time__c = existing.Clock_Out_Time__c,
                                Cost_Code__c = existing.Cost_Code__c,
                                Do_Not_Execute__c = true
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

            List<Cost_Code__c> costCodeRecs = [SELECT Id, Name FROM Cost_Code__c WITH USER_MODE ORDER BY Name ASC];
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
            List<Mobilization__c> mobRec = [
                SELECT Id, Name, Mobilization_Group__r.Start_Date__c, Mobilization_Group__r.End_Date__c 
                FROM Mobilization__c 
                WHERE Id = :mobId
                WITH USER_MODE
            ];
            mobGroupId = mobRec[0].Mobilization_Group__r.Id;

            List<Timesheet__c> tsList = [
                SELECT Id, Contact__c, Timesheet_Start_Date__c, Timesheet_End_Date__c
                FROM Timesheet__c
                WHERE Contact__c = :contactId
                AND Job__c = :jobId
                AND Timesheet_Start_Date__c <= :jobStartDate
                AND Timesheet_End_Date__c >= :jobEndDate
                WITH USER_MODE
            ];
            
            Timesheet__c tsRec = new Timesheet__c();

            if(tsList.size() == 0) {

                Timesheet__c timesheetRec = new Timesheet__c();
                timesheetRec.Contact__c = contactId;
                timesheetRec.Job__c = jobId;
                timesheetRec.Timesheet_Start_Date__c = mobRec[0].Mobilization_Group__r.Start_Date__c.date();
                timesheetRec.Timesheet_End_Date__c = mobRec[0].Mobilization_Group__r.End_Date__c.date();
                timesheetRec.Do_Not_Execute__c = true;
                timesheetRec.Mobilization_Group__c = mobGroupId;
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
                Timesheet_Entry__c entryDay1 = new Timesheet_Entry__c(
                    Timesheet__c = tsRec.Id,
                    Clock_In_Time__c = clkInUserTz,
                    Clock_Out_Time__c = firstDayEnd,
                    Cost_Code__c = costCodeId,
                    Mobilization__c = mobId,
                    Do_Not_Execute__c = true
                );
                insert entryDay1;

                Timesheet_Entry_Item__c itemDay1 = new Timesheet_Entry_Item__c(
                    Timesheet_Entry__c = entryDay1.Id,
                    Clock_In_Time__c = clkInUserTz,
                    Clock_Out_Time__c = firstDayEnd,
                    Cost_Code__c = costCodeId,
                    Travel_Time__c = travelTime,
                    Per_Diem__c = perDiem,
                    Do_Not_Execute__c = true
                );
                insert itemDay1;

                // Entry for day 2
                Timesheet_Entry__c entryDay2 = new Timesheet_Entry__c(
                    Timesheet__c = tsRec.Id,
                    Clock_In_Time__c = secondDayStart,
                    Clock_Out_Time__c = clkOutUserTz,
                    Cost_Code__c = costCodeId,
                    Mobilization__c = mobId,
                    Do_Not_Execute__c = true
                );
                insert entryDay2;

                Timesheet_Entry_Item__c itemDay2 = new Timesheet_Entry_Item__c(
                    Timesheet_Entry__c = entryDay2.Id,
                    Clock_In_Time__c = secondDayStart,
                    Clock_Out_Time__c = clkOutUserTz,
                    Cost_Code__c = costCodeId,
                    Do_Not_Execute__c = true
                );
                insert itemDay2;
            } else {
                // Normal same-day record
                Timesheet_Entry__c timesheetEntryRec = new Timesheet_Entry__c();
                timesheetEntryRec.Timesheet__c = tsRec.Id;
                timesheetEntryRec.Clock_In_Time__c = clkInUserTz;
                timesheetEntryRec.Clock_Out_Time__c = clkOutUserTz;
                timesheetEntryRec.Cost_Code__c = costCodeId;
                timesheetEntryRec.Do_Not_Execute__c = true;
                timesheetEntryRec.Mobilization__c = mobId;
                insert as user timesheetEntryRec;

                Timesheet_Entry_Item__c timesheetEntryItemRec = new Timesheet_Entry_Item__c();
                timesheetEntryItemRec.Timesheet_Entry__c = timesheetEntryRec.Id;
                timesheetEntryItemRec.Clock_In_Time__c = clkInUserTz;
                timesheetEntryItemRec.Clock_Out_Time__c = clkOutUserTz;
                timesheetEntryItemRec.Cost_Code__c = costCodeId;
                timesheetEntryItemRec.Travel_Time__c = travelTime;
                timesheetEntryItemRec.Per_Diem__c = perDiem;
                timesheetEntryItemRec.Do_Not_Execute__c = true;
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
            Timesheet_Entry_Item__c tsItem = [
                SELECT Id, Travel_Time__c, Per_Diem__c, Clock_In_Time__c, Clock_Out_Time__c, Premium__c 
                FROM Timesheet_Entry_Item__c 
                WHERE Id = :(String)jsonList.get('Id')
                WITH USER_MODE
                LIMIT 1
            ];

            Timesheet_Entry__c tsEntry = [
                SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Timesheet__c, Cost_Code__c 
                FROM Timesheet_Entry__c 
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
                tsEntry.Clock_In_Time__c = clkInUserTz;
                tsEntry.Clock_Out_Time__c = firstDayEnd;
                update tsEntry;

                tsItem.Clock_In_Time__c = clkInUserTz;
                tsItem.Clock_Out_Time__c = firstDayEnd;
                tsItem.Travel_Time__c = travelTime;
                tsItem.Per_Diem__c = perDiem;
                tsItem.Premium__c = premium;
                update tsItem;

                // Create new entry for day 2
                Timesheet_Entry__c entryDay2 = new Timesheet_Entry__c(
                    Timesheet__c = tsEntry.Timesheet__c,
                    Clock_In_Time__c = secondDayStart,
                    Clock_Out_Time__c = clkOutUserTz,
                    Cost_Code__c = tsEntry.Cost_Code__c,
                    Do_Not_Execute__c = true
                );
                insert entryDay2;

                Timesheet_Entry_Item__c itemDay2 = new Timesheet_Entry_Item__c(
                    Timesheet_Entry__c = entryDay2.Id,
                    Clock_In_Time__c = secondDayStart,
                    Clock_Out_Time__c = clkOutUserTz,
                    Cost_Code__c = tsEntry.Cost_Code__c,
                    Do_Not_Execute__c = true
                );
                insert itemDay2;
            } else {
                // Normal same-day update
                tsItem.Clock_In_Time__c = clkInUserTz;
                tsItem.Clock_Out_Time__c = clkOutUserTz;
                tsItem.Travel_Time__c = travelTime;
                tsItem.Per_Diem__c = perDiem;
                tsItem.Premium__c = premium;
                update tsItem;

                tsEntry.Clock_In_Time__c = clkInUserTz;
                tsEntry.Clock_Out_Time__c = clkOutUserTz;
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
            Timesheet_Entry_Item__c tsItem = [SELECT Id, Timesheet_Entry__c FROM Timesheet_Entry_Item__c WHERE Id = :TSELId];

            Timesheet_Entry__c tsEntry = [SELECT Id FROM Timesheet_Entry__c WHERE Id = :tsItem.Timesheet_Entry__c];

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

        public TimesheetEntryItemWrapper(Timesheet_Entry_Item__c item) {
            this.id = item.Id;
            this.TSEId = item.Timesheet_Entry__c;
            this.contactName = item.Timesheet_Entry__r.TimeSheet__r.Contact__r.Name;
            
            // Convert to user timezone
            this.clockInTime  = item.Clock_In_Time__c  != null ? item.Clock_In_Time__c.addSeconds(userTz.getOffset(item.Clock_In_Time__c)/1000)  : null;
            this.clockOutTime = item.Clock_Out_Time__c != null ? item.Clock_Out_Time__c.addSeconds(userTz.getOffset(item.Clock_Out_Time__c)/1000) : null;

            this.travelTime = item.Travel_Time__c != null ? item.Travel_Time__c : 0.00;
            this.perDiem = item.Per_Diem__c != null ? item.Per_Diem__c : 0;
            this.workHours = item.Total_Time__c != null ? item.Total_Time__c : 0.00;
            this.totalTime = this.workHours + this.travelTime;
            this.costCodeName = item.Cost_Code__r != null ? item.Cost_Code__r.Name : '-';
            this.premium = item.Premium__c;
            this.clockInDate = item.Clock_In_Date__c;
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