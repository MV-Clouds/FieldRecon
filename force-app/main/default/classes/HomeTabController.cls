public with sharing class HomeTabController {
    
    public static TimeZone userTz = UserInfo.getTimeZone();

    @AuraEnabled
    public static Map<String, Object> getMobilizationMembers(Date filterDate, String mode) {
        try {
            Map<String, Object> result = new Map<String, Object>();

            String userId = UserInfo.getUserId();
            Contact currentUserContact = [
                SELECT Id, Name 
                FROM Contact 
                WHERE User__c = :userId
                  AND RecordType.DeveloperName IN ('Employee_WF_Recon','Sub_Contractor_WF_Recon')
                LIMIT 1
            ];

            if(currentUserContact == null) {
                throw new AuraHandledException('No associated Contact found for the current user.');
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
                WITH SECURITY_ENFORCED
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
                ];

                for(Timesheet__c ts : tsList) jobTimesheetMap.put(ts.Job__c, ts);

                List<Timesheet_Entry__c> entries = [
                    SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Timesheet__r.Job__c
                    FROM Timesheet_Entry__c
                    WHERE Timesheet__c IN :tsList
                      AND Clock_In_Time__c >= :startDateTime
                      AND Clock_In_Time__c <= :endDateTime
                ];

                Map<Id, Timesheet_Entry__c> openEntryMap = new Map<Id, Timesheet_Entry__c>();
                for(Timesheet_Entry__c e : entries) {
                    if(e.Clock_In_Time__c != null && e.Clock_Out_Time__c == null) {
                        openEntryMap.put(e.Timesheet__r.Job__c, e);
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
            for(Cost_Code__c c : [SELECT Id, Name FROM Cost_Code__c]) costCodeDetails.put(c.Id, c.Name);
            WrapperMember costWrap = new WrapperMember();
            costWrap.costCodeDetails = costCodeDetails;
            result.put('costCodeDetails', new List<WrapperMember>{ costWrap });

            return result;

        } catch(Exception e) {
            System.debug('Exception: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static string getTimesheetDetails(){
        try {
            return null;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
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
    }
}