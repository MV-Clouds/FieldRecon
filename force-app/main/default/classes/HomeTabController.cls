/**
* Class Name: HomeTabController
* Test Class: HomeTabControllerTest
* @description: Controller for New Home Page
* Created Date: 6 Oct, 2025
* Created By: Harsh Gandhi
*--------------------------------------------------------------------------------
* Modification History:
* Date Modified - Developer Name - Description
* **/
public with sharing class HomeTabController {
    
    public static TimeZone userTz = UserInfo.getTimeZone();

    /*
    *********************************************************
    @description     : Method is used to get the current Member related job
    @param           : filterDate - {Date} - Date to filter the mobilization details
    @param           : mode - {String} - Mode to filter the mobilization details
    @return          : Map<String, Object> - Map of mobilization details
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getMobilizationMembers(Date filterDate, String mode) {
        try {
            System.debug('Fetching mobilization members for date: ' + filterDate + ' in mode: ' + mode);
            Map<String, Object> result = new Map<String, Object>();

            String userId = UserInfo.getUserId();
            
            Boolean hasAdminPermissions = false;
            List<PermissionSetAssignment> adminAssignments = [
                SELECT Id
                FROM PermissionSetAssignment
                WHERE AssigneeId = :userId
                AND PermissionSet.Name IN ('FR_Admin', 'FR_Crew_Boss')
                LIMIT 1
            ];
            if (!adminAssignments.isEmpty()) {
                hasAdminPermissions = true;
            }

            List<Contact> currentUserContactList = new List<Contact>();
            if(Test.isRunningTest()) {
                currentUserContactList = [SELECT Id, Name FROM Contact WITH USER_MODE LIMIT 1];
            } else {
                currentUserContactList = [
                    SELECT Id, Name 
                    FROM Contact 
                    WHERE wfrecon__User__c = :userId
                    AND RecordType.DeveloperName IN ('Employee_WF_Recon','Sub_Contractor_WF_Recon')
                    WITH USER_MODE
                    LIMIT 1
                ];
            }

            if(currentUserContactList == null || currentUserContactList.isEmpty()) {
                System.debug('You don’t have an associated contact record. Please contact your administrator.');
                result.put('ERROR', 'You don’t have an associated contact record. Please contact your administrator.');
                return result;
            }

            Contact currentUserContact = currentUserContactList[0];

            // Compute start/end datetime
            DateTime startDateTime;
            DateTime endDateTime;
            Date weekStart;
            Date weekEnd;

            if (mode == 'week') {
                weekStart = filterDate;
                weekEnd   = filterDate.addDays(6);
                startDateTime = DateTime.newInstance(weekStart, Time.newInstance(0,0,0,0));
                endDateTime   = DateTime.newInstance(weekEnd, Time.newInstance(23,59,59,999));
            } else {
                // For 'today' mode, use the single filtered date
                startDateTime = DateTime.newInstance(filterDate, Time.newInstance(0,0,0,0));
                endDateTime   = DateTime.newInstance(filterDate, Time.newInstance(23,59,59,999));
            }

            // Fetch mobilization members in range
            List<wfrecon__Mobilization_Member__c> mobMembers = [ 
                SELECT Id, wfrecon__Contact__c, wfrecon__Contact__r.Name, wfrecon__Mobilization__c, wfrecon__Crew__c,
                       wfrecon__Mobilization__r.wfrecon__Job__c, wfrecon__Mobilization__r.wfrecon__Start_Date__c, wfrecon__Mobilization__r.wfrecon__End_Date__c,
                       wfrecon__Mobilization__r.wfrecon__Job__r.Name, wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Description__c, wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Address__c,
                       wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Street__c, wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__City__c, 
                       wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__State__c, wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Zip_Code__c, wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Country__c 
                FROM wfrecon__Mobilization_Member__c 
                WHERE wfrecon__Contact__c = :currentUserContact.Id
                  AND wfrecon__Mobilization__r.wfrecon__Start_Date__c <= :endDateTime
                  AND wfrecon__Mobilization__r.wfrecon__End_Date__c >= :startDateTime 
                WITH USER_MODE
            ];

            if(mobMembers.isEmpty()) return result;

            if(mode == 'today') {
                // DAY MODE → include clock in/out info
                WrapperMember wrap; 
                Map<Id, wfrecon__Timesheet__c> jobTimesheetMap = new Map<Id, wfrecon__Timesheet__c>(); 
                List<Id> jobIds = new List<Id>();
                
                // Set to store Crew IDs linked to these mobilizations
                Set<Id> associatedCrewIds = new Set<Id>();

                for(wfrecon__Mobilization_Member__c m : mobMembers) {
                    if(m.wfrecon__Mobilization__r.wfrecon__Job__c != null) {
                        jobIds.add(m.wfrecon__Mobilization__r.wfrecon__Job__c);
                    }
                    if(m.wfrecon__Crew__c != null) {
                        associatedCrewIds.add(m.wfrecon__Crew__c);
                    }
                }

                // Check for Crew Leadership
                Set<Id> leaderCrewIds = new Set<Id>();
                if(!associatedCrewIds.isEmpty()) {
                    for(wfrecon__Crew_Member__c cm : [
                        SELECT wfrecon__Crew__c 
                        FROM wfrecon__Crew_Member__c 
                        WHERE wfrecon__Crew__c IN :associatedCrewIds 
                        AND wfrecon__Contact__c = :currentUserContact.Id 
                        AND wfrecon__Member_Type__c = 'Leader'
                        WITH USER_MODE
                    ]) {
                        leaderCrewIds.add(cm.wfrecon__Crew__c);
                    }
                }

                List<wfrecon__Timesheet__c> tsList = [ 
                    SELECT Id, wfrecon__Contact__c, wfrecon__Job__c
                    FROM wfrecon__Timesheet__c 
                    WHERE wfrecon__Contact__c = :currentUserContact.Id
                      AND wfrecon__Job__c IN :jobIds
                      AND wfrecon__Timesheet_Start_Date__c <= :filterDate 
                      AND wfrecon__Timesheet_End_Date__c >= :filterDate 
                    WITH USER_MODE
                ];

                for(wfrecon__Timesheet__c ts : tsList) jobTimesheetMap.put(ts.wfrecon__Job__c, ts); 

                List<wfrecon__Timesheet_Entry__c> entries = [ 
                    SELECT Id, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Timesheet__r.wfrecon__Job__c 
                    FROM wfrecon__Timesheet_Entry__c 
                    WHERE wfrecon__Timesheet__c IN :tsList
                      AND wfrecon__Clock_In_Time__c >= :startDateTime
                      AND wfrecon__Clock_In_Time__c <= :endDateTime
                    WITH USER_MODE
                    ORDER BY CreatedDate DESC 
                ];

                Map<Id,wfrecon__Timesheet_Entry__c> openEntryMap = new Map<Id, wfrecon__Timesheet_Entry__c>(); 
                Map<Id, Integer> completedCountMap = new Map<Id, Integer>();
                
                Map<Id, wfrecon__Timesheet_Entry__c> latestCompletedMap = new Map<Id, wfrecon__Timesheet_Entry__c>();

                for(wfrecon__Timesheet_Entry__c e : entries) { 
                    if(e.wfrecon__Clock_In_Time__c != null && e.wfrecon__Clock_Out_Time__c == null) { 
                        openEntryMap.put(e.wfrecon__Timesheet__r.wfrecon__Job__c, e); 
                    } else if (e.wfrecon__Clock_In_Time__c != null && e.wfrecon__Clock_Out_Time__c != null) { 
                        completedCountMap.put(e.wfrecon__Timesheet__r.wfrecon__Job__c, 
                            completedCountMap.containsKey(e.wfrecon__Timesheet__r.wfrecon__Job__c) 
                                ? completedCountMap.get(e.wfrecon__Timesheet__r.wfrecon__Job__c) + 1 // Fixed logic: +1
                                : 1
                        );

                        // Capture the first one found (latest due to DESC sort)
                        if(!latestCompletedMap.containsKey(e.wfrecon__Timesheet__r.wfrecon__Job__c)){
                            latestCompletedMap.put(e.wfrecon__Timesheet__r.wfrecon__Job__c, e);
                        }
                    }
                }

                List<WrapperMember> dayJobs = new List<WrapperMember>(); 
                for(wfrecon__Mobilization_Member__c m : mobMembers) { 
                    wrap = new WrapperMember(); 
                    wrap.jobStartTime = m.wfrecon__Mobilization__r.wfrecon__Start_Date__c.addSeconds(userTz.getOffset(m.wfrecon__Mobilization__r.wfrecon__Start_Date__c)/1000); 
                    wrap.jobEndTime   = m.wfrecon__Mobilization__r.wfrecon__End_Date__c.addSeconds(userTz.getOffset(m.wfrecon__Mobilization__r.wfrecon__End_Date__c)/1000); 
                    wrap.contactId    = m.wfrecon__Contact__c; 
                    wrap.contactName  = m.wfrecon__Contact__r.Name; 
                    wrap.mobMemberId  = m.Id;
                    wrap.mobId          = m.wfrecon__Mobilization__c; 
                    wrap.jobId          = m.wfrecon__Mobilization__r.wfrecon__Job__c; 
                    wrap.jobName = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Job_Name__c != null ? m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Job_Name__c : '--'; 
                    wrap.jobNumber = m.wfrecon__Mobilization__r.wfrecon__Job__r.Name; 
                    wrap.jobDescription = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Description__c; 
                    wrap.jobAddress     = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Address__c != null ? m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Address__c : '--'; 
                    wrap.jobStreet     = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Street__c != null ? m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Street__c : '--'; 
                    wrap.jobCity     = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__City__c != null ? m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__City__c : '--'; 
                    wrap.jobState     = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__State__c != null ? m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__State__c : '--'; 
                    wrap.jobPostalCode     = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Zip_Code__c != null ? m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Zip_Code__c : '--'; 
                    wrap.jobCountry     = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Country__c != null ? m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Country__c : '--'; 

                    wfrecon__Timesheet__c ts = jobTimesheetMap.get(m.wfrecon__Mobilization__r.wfrecon__Job__c); 
                    wfrecon__Timesheet_Entry__c openEntry = openEntryMap.get(m.wfrecon__Mobilization__r.wfrecon__Job__c); 

                    wrap.timesheetId      = ts != null ? ts.Id : null;
                    wrap.isTimeSheetNull  = ts == null;
                    wrap.timesheetEntryId = openEntry != null ? openEntry.Id : null;
                    wrap.isTimeSheetEntryNull = openEntry == null;
                    wrap.isClockedIn      = openEntry != null;
                    wrap.clockInTime      = openEntry != null ? openEntry.wfrecon__Clock_In_Time__c.addSeconds(userTz.getOffset(openEntry.wfrecon__Clock_In_Time__c)/1000) : null; 

                    Integer completedCount = completedCountMap.containsKey(m.wfrecon__Mobilization__r.wfrecon__Job__c) 
                        ? completedCountMap.get(m.wfrecon__Mobilization__r.wfrecon__Job__c) 
                        : 0;
                    wrap.isAgain = (completedCount > 0);

                    // POPULATE LAST ENTRY TIMES IF AVAILABLE
                    if(wrap.isAgain && latestCompletedMap.containsKey(m.wfrecon__Mobilization__r.wfrecon__Job__c)){
                        wfrecon__Timesheet_Entry__c lastEntry = latestCompletedMap.get(m.wfrecon__Mobilization__r.wfrecon__Job__c);
                        wrap.lastClockInTime = lastEntry.wfrecon__Clock_In_Time__c.addSeconds(userTz.getOffset(lastEntry.wfrecon__Clock_In_Time__c)/1000);
                        wrap.lastClockOutTime = lastEntry.wfrecon__Clock_Out_Time__c.addSeconds(userTz.getOffset(lastEntry.wfrecon__Clock_Out_Time__c)/1000);
                    }

                    // DETERMINE IF USER IS LEADER FOR THIS JOB'S CREW
                    if (hasAdminPermissions || (m.wfrecon__Crew__c != null && leaderCrewIds.contains(m.wfrecon__Crew__c))) {
                        wrap.isCrewLeader = true;
                    } else {
                        wrap.isCrewLeader = false;
                    }

                    dayJobs.add(wrap);
                }

                result.put('dayJobs', dayJobs);

            } else {
                // WEEK MODE → from today (inclusive) to next 6 days (7 total)
                Date weekStartD = filterDate; // Start date of the 7-day window
                Date weekEndD = weekStartD.addDays(6); // End date of the 7-day window
                
                Map<String, List<WrapperMember>> weekMap = new Map<String, List<WrapperMember>>(); 

                for(wfrecon__Mobilization_Member__c m : mobMembers) { 
                    Date start = m.wfrecon__Mobilization__r.wfrecon__Start_Date__c.date(); 
                    Date endD   = m.wfrecon__Mobilization__r.wfrecon__End_Date__c.date(); 

                    // limit job's display within the 7-day window (Today to Today + 6)
                    Date fromD = (start > weekStartD) ? start : weekStartD;
                    Date to    = (endD < weekEndD) ? endD : weekEndD;

                    for(Date d = fromD; d <= to; d = d.addDays(1)) {
                        
                        // FIX: Use simple 'YYYY-MM-DD' key for guaranteed match with LWC
                        String key = String.valueOf(d); 
                        
                        if(!weekMap.containsKey(key)) weekMap.put(key, new List<WrapperMember>()); 
                        
                        WrapperMember wrap = new WrapperMember(); 
                        wrap.jobStartTime = m.wfrecon__Mobilization__r.wfrecon__Start_Date__c.addSeconds(userTz.getOffset(m.wfrecon__Mobilization__r.wfrecon__Start_Date__c)/1000); 
                        wrap.jobEndTime   = m.wfrecon__Mobilization__r.wfrecon__End_Date__c.addSeconds(userTz.getOffset(m.wfrecon__Mobilization__r.wfrecon__End_Date__c)/1000); 
                        wrap.contactId    = m.wfrecon__Contact__c; 
                        wrap.contactName  = m.wfrecon__Contact__r.Name; 
                        wrap.mobMemberId  = m.Id;
                        wrap.mobId          = m.wfrecon__Mobilization__c; 
                        wrap.jobId          = m.wfrecon__Mobilization__r.wfrecon__Job__c; 
                        wrap.jobName = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Job_Name__c != null ? m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Job_Name__c : '--'; 
                        wrap.jobNumber = m.wfrecon__Mobilization__r.wfrecon__Job__r.Name; 
                        wrap.jobDescription = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Description__c; 
                        wrap.jobAddress     = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Address__c != null ? m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Address__c : '--'; 
                        wrap.jobStreet     = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Street__c != null ? m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Street__c : '--'; 
                        wrap.jobCity     = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__City__c != null ? m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__City__c : '--'; 
                        wrap.jobState     = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__State__c != null ? m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__State__c : '--'; 
                        wrap.jobPostalCode     = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Zip_Code__c != null ? m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Zip_Code__c : '--'; 
                        wrap.jobCountry     = m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Country__c != null ? m.wfrecon__Mobilization__r.wfrecon__Job__r.wfrecon__Country__c : '--'; 
                        weekMap.get(key).add(wrap);
                    }
                }

                result.put('weekJobs', weekMap);
            }

            // Add cost codes
            Map<Id, String> costCodeDetails = new Map<Id, String>();
            for(wfrecon__Cost_Code__c c : [SELECT Id, Name FROM wfrecon__Cost_Code__c WITH USER_MODE]) costCodeDetails.put(c.Id, c.Name); 
            WrapperMember costWrap = new WrapperMember(); 
            costWrap.costCodeDetails = costCodeDetails;
            result.put('costCodeDetails', new List<WrapperMember>{ costWrap }); 

            return result;

        } catch(Exception e) {
            System.debug('Exception: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'HomeTabController', 'methodName' => 'getMobilizationMembers', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    /*
    *********************************************************
    @description     : Method is used to get the past week's timesheets
    @return          : List<TimesheetEntryItemWrapper> - : List of Timesheet details
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getTimeSheetEntryItems(){
        try {
            Map<String, Object> result = new Map<String, Object>();

            String userId = UserInfo.getUserId();
            List<Contact> currentUserContactList = new List<Contact>();
            if(Test.isRunningTest()) {
                currentUserContactList = [SELECT Id, Name FROM Contact WITH USER_MODE LIMIT 1];
            } else {
                currentUserContactList = [
                    SELECT Id, Name 
                    FROM Contact 
                    WHERE wfrecon__User__c = :userId
                    AND RecordType.DeveloperName IN ('Employee_WF_Recon','Sub_Contractor_WF_Recon')
                    WITH USER_MODE
                    LIMIT 1
                ];
            }

            if(currentUserContactList == null || currentUserContactList.isEmpty()) {
                System.debug('You don’t have an associated contact record. Please contact your administrator.');
                result.put('ERROR', 'You don’t have an associated contact record. Please contact your administrator.');
                return result;
            }

            Contact currentUserContact = currentUserContactList[0];
            
            Date todayDate = Date.today();

            // Calculate start (Sunday) and end (Saturday) of this week
            Date startOfWeek = todayDate.toStartOfWeek(); // Sunday
            Date endOfWeek = startOfWeek.addDays(6);      // Saturday

            List<wfrecon__Timesheet_Entry_Item__c> items = [
                SELECT Id, wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Job__c, wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Job__r.Name, wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Job__r.wfrecon__Job_Name__c,
                       wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Travel_Time__c, wfrecon__Total_Time__c, 
                       wfrecon__Cost_Code__r.Name, wfrecon__Clock_In_Date__c
                FROM wfrecon__Timesheet_Entry_Item__c 
                WHERE wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Contact__c = :currentUserContact.Id
                  AND wfrecon__Clock_In_Date__c >= :startOfWeek
                  AND wfrecon__Clock_In_Date__c <= :endOfWeek
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];

            List<TimesheetEntryItemWrapper> timesheetList = new List<TimesheetEntryItemWrapper>();
            for(wfrecon__Timesheet_Entry_Item__c item : items) {
                timesheetList.add(new TimesheetEntryItemWrapper(item));
            }

            result.put('timesheetEntries', timesheetList);
            return result;
        } catch (Exception e) {
            System.debug('Exception in getTimeSheetEntryItems: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobDetailsPageController', 'methodName' => 'getTimeSheetEntryItems', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    public class WrapperMember {
        @AuraEnabled public Id contactId;
        @AuraEnabled public String contactName;
        @AuraEnabled public DateTime jobStartTime;
        @AuraEnabled public DateTime jobEndTime;
        @AuraEnabled public String jobId;
        @AuraEnabled public String jobName;
        @AuraEnabled public String jobNumber;
        @AuraEnabled public String jobDescription;
        @AuraEnabled public String jobAddress;
        @AuraEnabled public String jobStreet;
        @AuraEnabled public String jobCity;
        @AuraEnabled public String jobState;
        @AuraEnabled public String jobPostalCode;
        @AuraEnabled public String jobCountry;
        @AuraEnabled public DateTime clockInTime;
        @AuraEnabled public Boolean isClockedIn;
        @AuraEnabled public Boolean isTimesheetNull;
        @AuraEnabled public String timesheetId;
        @AuraEnabled public Boolean isTimesheetEntryNull;
        @AuraEnabled public String timesheetEntryId;
        @AuraEnabled public String mobId;
        @AuraEnabled public String mobMemberId;
        @AuraEnabled public Map<Id, String> costCodeDetails;
        @AuraEnabled public Boolean isAgain;
        @AuraEnabled public DateTime lastClockInTime;
        @AuraEnabled public DateTime lastClockOutTime;
        @AuraEnabled public Boolean isCrewLeader;
    }

    public class TimesheetEntryItemWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public String jobId;
        @AuraEnabled public String jobNumber;
        @AuraEnabled public String jobName;
        @AuraEnabled public Datetime clockInTime;
        @AuraEnabled public Datetime clockOutTime;
        @AuraEnabled public Decimal workHours;
        @AuraEnabled public Decimal travelTime;
        @AuraEnabled public Decimal totalTime;
        @AuraEnabled public String costCodeName;
        @AuraEnabled public Date clockInDate;

        public TimesheetEntryItemWrapper(wfrecon__Timesheet_Entry_Item__c item) {
            this.id = item.Id;
            this.jobNumber = item.wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Job__r.Name;
            this.jobId = item.wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Job__r.Id;
            this.jobName = item.wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Job__r.wfrecon__Job_Name__c;
            
            // Convert to user timezone
            this.clockInTime  = item.wfrecon__Clock_In_Time__c  != null ? item.wfrecon__Clock_In_Time__c.addSeconds(userTz.getOffset(item.wfrecon__Clock_In_Time__c)/1000)  : null;
            this.clockOutTime = item.wfrecon__Clock_Out_Time__c != null ? item.wfrecon__Clock_Out_Time__c.addSeconds(userTz.getOffset(item.wfrecon__Clock_Out_Time__c)/1000) : null;
            this.workHours = item.wfrecon__Total_Time__c != null ? item.wfrecon__Total_Time__c : 0.00;
            this.travelTime = item.wfrecon__Travel_Time__c != null ? item.wfrecon__Travel_Time__c : 0.00;
            this.totalTime = this.workHours + this.travelTime;
            this.costCodeName = item.wfrecon__Cost_Code__r != null ? item.wfrecon__Cost_Code__r.Name : '-';
            this.clockInDate = item.wfrecon__Clock_In_Date__c;
        }
    }
}