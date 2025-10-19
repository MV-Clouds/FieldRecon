/**
* Class Name: HomeTabController
* Test Class: HomeTabControllerTest
* @description: Controller for New Home Page
* Created Date: 6 Oct, 2025
* Created By: Harsh Gandhi
*--------------------------------------------------------------------------------
* Modification History:
* Date Modified - Developer Name - Description
* 
**/
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
            Map<String, Object> result = new Map<String, Object>();

            String userId = UserInfo.getUserId();
            Contact currentUserContact = new Contact();
            if(Test.isRunningTest()) {
                currentUserContact = [SELECT Id, Name FROM Contact WITH USER_MODE LIMIT 1];
            } else {
                currentUserContact = [
                    SELECT Id, Name 
                    FROM Contact 
                    WHERE User__c = :userId
                    AND RecordType.DeveloperName IN ('Employee_WF_Recon','Sub_Contractor_WF_Recon')
                    WITH USER_MODE
                    LIMIT 1
                ];
            }

            if(currentUserContact == null) {
                System.debug('No associated Contact found for the current user.');
            }

            // Compute start/end datetime
            DateTime startDateTime;
            DateTime endDateTime;
            Date weekStart;
            Date weekEnd;

            if (mode == 'week') {
                Integer dow = Integer.valueOf(DateTime.newInstance(filterDate, Time.newInstance(0,0,0,0)).format('u'));
                weekStart = filterDate.addDays(-(dow-1)); // Sunday
                weekEnd   = weekStart.addDays(6);         // Saturday
                startDateTime = DateTime.newInstance(weekStart, Time.newInstance(0,0,0,0));
                endDateTime   = DateTime.newInstance(weekEnd, Time.newInstance(23,59,59,999));
            } else {
                startDateTime = DateTime.newInstance(filterDate, Time.newInstance(0,0,0,0));
                endDateTime   = DateTime.newInstance(filterDate, Time.newInstance(23,59,59,999));
            }

            // Fetch mobilization members in range
            List<Mobilization_Member__c> mobMembers = [
                SELECT Id, Contact__c, Contact__r.Name, Mobilization__c,
                       Mobilization__r.Job__c, Mobilization__r.Start_Date__c, Mobilization__r.End_Date__c,
                       Mobilization__r.Job__r.Name, Mobilization__r.Job__r.Description__c, Mobilization__r.Job__r.Address__c,
                       Mobilization__r.Job__r.Job_Name__c, Mobilization__r.Job__r.Street__c, Mobilization__r.Job__r.City__c,
                       Mobilization__r.Job__r.State__c, Mobilization__r.Job__r.Zip_Code__c, Mobilization__r.Job__r.Country__c
                FROM Mobilization_Member__c
                WHERE Contact__c = :currentUserContact.Id
                  AND Mobilization__r.Start_Date__c <= :endDateTime
                  AND Mobilization__r.End_Date__c >= :startDateTime
                WITH USER_MODE
            ];

            if(mobMembers.isEmpty()) return result;

            if(mode == 'today') {
                // DAY MODE → include clock in/out info
                WrapperMember wrap;
                Map<Id, Timesheet__c> jobTimesheetMap = new Map<Id, Timesheet__c>();
                List<Id> jobIds = new List<Id>();
                for(Mobilization_Member__c m : mobMembers) jobIds.add(m.Mobilization__r.Job__c);

                List<Timesheet__c> tsList = [
                    SELECT Id, Contact__c, Job__c
                    FROM Timesheet__c
                    WHERE Contact__c = :currentUserContact.Id
                      AND Job__c IN :jobIds
                      AND Timesheet_Start_Date__c <= :filterDate
                      AND Timesheet_End_Date__c >= :filterDate
                    WITH USER_MODE
                ];

                for(Timesheet__c ts : tsList) jobTimesheetMap.put(ts.Job__c, ts);

                List<Timesheet_Entry__c> entries = [
                    SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Timesheet__r.Job__c
                    FROM Timesheet_Entry__c
                    WHERE Timesheet__c IN :tsList
                      AND Clock_In_Time__c >= :startDateTime
                      AND Clock_In_Time__c <= :endDateTime
                    WITH USER_MODE
                ];

                Map<Id, Timesheet_Entry__c> openEntryMap = new Map<Id, Timesheet_Entry__c>();
                Map<Id, Integer> completedCountMap = new Map<Id, Integer>();
                for(Timesheet_Entry__c e : entries) {
                    if(e.Clock_In_Time__c != null && e.Clock_Out_Time__c == null) {
                        openEntryMap.put(e.Timesheet__r.Job__c, e);
                    } else if (e.Clock_In_Time__c != null && e.Clock_Out_Time__c != null) {
                        // Count completed entries
                        completedCountMap.put(e.Timesheet__r.Job__c,
                            completedCountMap.containsKey(e.Timesheet__r.Job__c)
                                ? completedCountMap.get(e.Timesheet__r.Job__c) + 1
                                : 1
                        );
                    }
                }

                List<WrapperMember> dayJobs = new List<WrapperMember>();
                for(Mobilization_Member__c m : mobMembers) {
                    wrap = new WrapperMember();
                    wrap.jobStartTime = m.Mobilization__r.Start_Date__c.addSeconds(userTz.getOffset(m.Mobilization__r.Start_Date__c)/1000);
                    wrap.jobEndTime   = m.Mobilization__r.End_Date__c.addSeconds(userTz.getOffset(m.Mobilization__r.End_Date__c)/1000);
                    wrap.contactId    = m.Contact__c;
                    wrap.contactName  = m.Contact__r.Name;
                    wrap.mobMemberId  = m.Id;
                    wrap.mobId          = m.Mobilization__c;
                    wrap.jobId          = m.Mobilization__r.Job__c;
                    wrap.jobName = m.Mobilization__r.Job__r.Job_Name__c;
                    wrap.jobNumber = m.Mobilization__r.Job__r.Name;
                    wrap.jobDescription = m.Mobilization__r.Job__r.Description__c;
                    wrap.jobAddress     = m.Mobilization__r.Job__r.Address__c;
                    wrap.jobStreet     = m.Mobilization__r.Job__r.Street__c;
                    wrap.jobCity     = m.Mobilization__r.Job__r.City__c;
                    wrap.jobState     = m.Mobilization__r.Job__r.State__c;
                    wrap.jobPostalCode     = m.Mobilization__r.Job__r.Zip_Code__c;
                    wrap.jobCountry     = m.Mobilization__r.Job__r.Country__c;

                    Timesheet__c ts = jobTimesheetMap.get(m.Mobilization__r.Job__c);
                    Timesheet_Entry__c openEntry = openEntryMap.get(m.Mobilization__r.Job__c);

                    wrap.timesheetId      = ts != null ? ts.Id : null;
                    wrap.isTimeSheetNull  = ts == null;
                    wrap.timesheetEntryId = openEntry != null ? openEntry.Id : null;
                    wrap.isTimeSheetEntryNull = openEntry == null;
                    wrap.isClockedIn      = openEntry != null;
                    wrap.clockInTime      = openEntry != null ? openEntry.Clock_In_Time__c.addSeconds(userTz.getOffset(openEntry.Clock_In_Time__c)/1000) : null;

                    Integer completedCount = completedCountMap.containsKey(m.Mobilization__r.Job__c)
                        ? completedCountMap.get(m.Mobilization__r.Job__c)
                        : 0;
                    wrap.isAgain = (completedCount > 0);

                    dayJobs.add(wrap);
                }

                result.put('dayJobs', dayJobs);

            } else {
                // WEEK MODE → from today (inclusive) to next 6 days (7 total)
                Date weekStartD = Date.today();
                Date weekEndD = weekStart.addDays(6); // next 7 days window
                Map<Date, List<WrapperMember>> weekMap = new Map<Date, List<WrapperMember>>();

                for(Mobilization_Member__c m : mobMembers) {
                    Date start = m.Mobilization__r.Start_Date__c.date();
                    Date endD   = m.Mobilization__r.End_Date__c.date();

                    // limit within selected week window
                    Date fromD = (start > weekStartD) ? start : weekStartD;
                    Date to    = (endD < weekEndD) ? endD : weekEndD;

                    for(Date d = fromD; d <= to; d = d.addDays(1)) {
                        if(!weekMap.containsKey(d)) weekMap.put(d, new List<WrapperMember>());
                        WrapperMember wrap = new WrapperMember();
                        wrap.jobStartTime = m.Mobilization__r.Start_Date__c;
                        wrap.jobEndTime   = m.Mobilization__r.End_Date__c;
                        wrap.contactId    = m.Contact__c;
                        wrap.contactName  = m.Contact__r.Name;
                        wrap.mobMemberId  = m.Id;
                        wrap.mobId          = m.Mobilization__c;
                        wrap.jobId          = m.Mobilization__r.Job__c;
                        wrap.jobName = m.Mobilization__r.Job__r.Job_Name__c;
                        wrap.jobNumber = m.Mobilization__r.Job__r.Name;
                        wrap.jobDescription = m.Mobilization__r.Job__r.Description__c;
                        wrap.jobAddress     = m.Mobilization__r.Job__r.Address__c;
                        wrap.jobStreet     = m.Mobilization__r.Job__r.Street__c;
                        wrap.jobCity     = m.Mobilization__r.Job__r.City__c;
                        wrap.jobState     = m.Mobilization__r.Job__r.State__c;
                        wrap.jobPostalCode     = m.Mobilization__r.Job__r.Zip_Code__c;
                        wrap.jobCountry     = m.Mobilization__r.Job__r.Country__c;
                        weekMap.get(d).add(wrap);
                    }
                }

                result.put('weekJobs', weekMap);
            }

            // Add cost codes
            Map<Id, String> costCodeDetails = new Map<Id, String>();
            for(Cost_Code__c c : [SELECT Id, Name FROM Cost_Code__c WITH USER_MODE]) costCodeDetails.put(c.Id, c.Name);
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
    public static List<TimesheetEntryItemWrapper> getTimeSheetEntryItems(){
        try {
            String userId = UserInfo.getUserId();
            Contact currentUserContact = new Contact();
            if(Test.isRunningTest()) {
                currentUserContact = [SELECT Id, Name FROM Contact WITH USER_MODE LIMIT 1];
            } else {
                currentUserContact = [
                    SELECT Id, Name 
                    FROM Contact 
                    WHERE User__c = :userId
                    AND RecordType.DeveloperName IN ('Employee_WF_Recon','Sub_Contractor_WF_Recon')
                    WITH USER_MODE
                    LIMIT 1
                ];
            }

            if(currentUserContact == null) {
                System.debug('No associated Contact found for the current user.');
            }
            
            Date todayDate = Date.today();

            // Calculate start (Sunday) and end (Saturday) of this week
            Date startOfWeek = todayDate.toStartOfWeek(); // Sunday
            Date endOfWeek = startOfWeek.addDays(6);      // Saturday

            List<Timesheet_Entry_Item__c> items = [
                SELECT Id, Timesheet_Entry__r.TimeSheet__r.Job__c, Timesheet_Entry__r.TimeSheet__r.Job__r.Name, Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,
                       Clock_In_Time__c, Clock_Out_Time__c, Travel_Time__c, Total_Time__c, 
                       Cost_Code__r.Name, Clock_In_Date__c
                FROM Timesheet_Entry_Item__c 
                WHERE Timesheet_Entry__r.TimeSheet__r.Contact__c = :currentUserContact.Id
                  AND Clock_In_Date__c >= :startOfWeek
                  AND Clock_In_Date__c <= :endOfWeek
                WITH USER_MODE
                ORDER BY CreatedDate DESC
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
    }

    public class TimesheetEntryItemWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public String jobNumber;
        @AuraEnabled public String jobName;
        @AuraEnabled public Datetime clockInTime;
        @AuraEnabled public Datetime clockOutTime;
        @AuraEnabled public Decimal workHours;
        @AuraEnabled public Decimal travelTime;
        @AuraEnabled public Decimal totalTime;
        @AuraEnabled public String costCodeName;
        @AuraEnabled public Date clockInDate;

        public TimesheetEntryItemWrapper(Timesheet_Entry_Item__c item) {
            this.id = item.Id;
            this.jobNumber = item.Timesheet_Entry__r.TimeSheet__r.Job__r.Name;
            this.jobName = item.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c;
            
            // Convert to user timezone
            this.clockInTime  = item.Clock_In_Time__c  != null ? item.Clock_In_Time__c.addSeconds(userTz.getOffset(item.Clock_In_Time__c)/1000)  : null;
            this.clockOutTime = item.Clock_Out_Time__c != null ? item.Clock_Out_Time__c.addSeconds(userTz.getOffset(item.Clock_Out_Time__c)/1000) : null;
            this.workHours = item.Total_Time__c != null ? item.Total_Time__c : 0.00;
            this.travelTime = item.Travel_Time__c != null ? item.Travel_Time__c : 0.00;
            this.totalTime = this.workHours + this.travelTime;
            this.costCodeName = item.Cost_Code__r != null ? item.Cost_Code__r.Name : '-';
            this.clockInDate = item.Clock_In_Date__c;
        }
    }
}