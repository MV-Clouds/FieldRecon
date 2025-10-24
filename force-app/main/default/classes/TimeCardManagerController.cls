public with sharing class TimeCardManagerController {
    
    public static TimeZone userTz = UserInfo.getTimeZone();
    public static final String CLASSNAME = 'TimeCardManagerController';

    /*
    *********************************************************
    @description     : Method is used to get all contacts from mobilization members with date filtering
    @param           : customStartDate - {Date} - Custom start date for filtering
    @param           : customEndDate - {Date} - Custom end date for filtering
    @return          : List<ContactWrapper> - List of contact details with mobilizations and timesheets
    ********************************************************
    */
    @AuraEnabled
    public static List<ContactWrapper> getAllContactsWithDetails(Date customStartDate, Date customEndDate) {
        try {
            DateTime startOfDay;
            DateTime endOfDay;

            // Build date filters
            if (customStartDate != null && customEndDate != null) {
                startOfDay = DateTime.newInstance(customStartDate, Time.newInstance(0,0,0,0));
                endOfDay   = DateTime.newInstance(customEndDate, Time.newInstance(23,59,59,999));
            } else {
                Date today = Date.today();
                startOfDay = DateTime.newInstance(today, Time.newInstance(0,0,0,0));
                endOfDay   = DateTime.newInstance(today, Time.newInstance(23,59,59,999));
            }

            // Fetch mobilization members with
            List<Mobilization_Member__c> mobilizationMembers = [
                SELECT Id, Contact__c, Contact__r.Name, Contact__r.RecordType.DeveloperName, 
                       Contact__r.Can_Clock_In_Out__c, Contact__r.Email, Contact__r.Phone,
                       Mobilization__c, Mobilization__r.Job__c, Mobilization__r.Job__r.Name, 
                       Mobilization__r.Job__r.Job_Name__c, Mobilization__r.Start_Date__c, 
                       Mobilization__r.End_Date__c, Mobilization__r.Job__r.Address__c,
                       Mobilization__r.Job__r.Description__c, Mobilization__r.Job__r.Status__c
                FROM Mobilization_Member__c 
                WHERE Contact__c != null 
                AND Contact__r.RecordType.DeveloperName IN ('Employee_WF_Recon','Sub_Contractor_WF_Recon')
                AND Mobilization__r.Start_Date__c >= :startOfDay 
                AND Mobilization__r.Start_Date__c <= :endOfDay
                WITH USER_MODE
                ORDER BY Contact__r.Name ASC, Mobilization__r.Start_Date__c ASC
            ];

            if (mobilizationMembers.isEmpty()) {
                return new List<ContactWrapper>();
            }

            // Group data by contact
            Map<Id, ContactWrapper> contactMap = new Map<Id, ContactWrapper>();
            Set<Id> contactIds = new Set<Id>();
            Set<Id> jobIds = new Set<Id>();
            Map<String, Set<Date>> contactJobDateMap = new Map<String, Set<Date>>();

            for (Mobilization_Member__c member : mobilizationMembers) {
                contactIds.add(member.Contact__c);
                jobIds.add(member.Mobilization__r.Job__c);

                // Track contact-job-date combinations for man hours calculation
                String contactJobKey = member.Contact__c + '_' + member.Mobilization__r.Job__c;
                if (!contactJobDateMap.containsKey(contactJobKey)) {
                    contactJobDateMap.put(contactJobKey, new Set<Date>());
                }
                contactJobDateMap.get(contactJobKey).add(member.Mobilization__r.Start_Date__c.date());

                if (!contactMap.containsKey(member.Contact__c)) {
                    ContactWrapper wrapper = new ContactWrapper();
                    wrapper.contactId = member.Contact__c;
                    wrapper.contactName = member.Contact__r.Name;
                    wrapper.developerName = member.Contact__r.RecordType.DeveloperName;
                    wrapper.canClockInOut = member.Contact__r.Can_Clock_In_Out__c;
                    wrapper.email = member.Contact__r.Email;
                    wrapper.phone = member.Contact__r.Phone;
                    wrapper.mobilizationGroups = new List<MobilizationGroupWrapper>();
                    wrapper.timesheetEntries = new List<TimesheetEntryWrapper>();
                    wrapper.totalManHours = 0.00;
                    
                    contactMap.put(member.Contact__c, wrapper);
                }

                // Check if this job already exists for this contact to avoid duplicates
                ContactWrapper existingContact = contactMap.get(member.Contact__c);
                Boolean jobExists = false;
                for (MobilizationGroupWrapper existingMob : existingContact.mobilizationGroups) {
                    if (existingMob.jobId == member.Mobilization__r.Job__c) {
                        jobExists = true;
                        // Update the date range if this mobilization has earlier start or later end dates
                        if (member.Mobilization__r.Start_Date__c < existingMob.startDate) {
                            existingMob.startDate = member.Mobilization__r.Start_Date__c.addSeconds(userTz.getOffset(member.Mobilization__r.Start_Date__c)/1000);
                        }
                        if (member.Mobilization__r.End_Date__c > existingMob.endDate) {
                            existingMob.endDate = member.Mobilization__r.End_Date__c.addSeconds(userTz.getOffset(member.Mobilization__r.End_Date__c)/1000);
                        }
                        break;
                    }
                }

                // Only add mobilization group if job doesn't already exist for this contact
                if (!jobExists) {
                    MobilizationGroupWrapper mobGroup = new MobilizationGroupWrapper();
                    mobGroup.mobilizationId = member.Mobilization__c;
                    mobGroup.jobId = member.Mobilization__r.Job__c;
                    mobGroup.jobName = member.Mobilization__r.Job__r.Job_Name__c;
                    mobGroup.jobNumber = member.Mobilization__r.Job__r.Name;
                    mobGroup.jobAddress = member.Mobilization__r.Job__r.Address__c;
                    mobGroup.jobDescription = member.Mobilization__r.Job__r.Description__c;
                    mobGroup.jobStatus = member.Mobilization__r.Job__r.Status__c;
                    mobGroup.startDate = member.Mobilization__r.Start_Date__c.addSeconds(userTz.getOffset(member.Mobilization__r.Start_Date__c)/1000);
                    mobGroup.endDate = member.Mobilization__r.End_Date__c.addSeconds(userTz.getOffset(member.Mobilization__r.End_Date__c)/1000);
                    mobGroup.totalManHours = 0.00;
                    
                    contactMap.get(member.Contact__c).mobilizationGroups.add(mobGroup);
                }
            }

            // Calculate total man hours for each contact-job combination (across all dates in range)
            Map<String, Decimal> contactJobManHoursMap = new Map<String, Decimal>();
            for (AggregateResult ar : [
                SELECT Timesheet_Entry__r.TimeSheet__r.Contact__c contactId,
                       Timesheet_Entry__r.TimeSheet__r.Job__c jobId,
                       SUM(Total_Time__c) totalHours
                FROM Timesheet_Entry_Item__c
                WHERE Timesheet_Entry__r.TimeSheet__r.Contact__c IN :contactIds
                AND Timesheet_Entry__r.TimeSheet__r.Job__c IN :jobIds
                AND Clock_In_Date__c >= :customStartDate
                AND Clock_In_Date__c <= :customEndDate
                AND Clock_In_Date__c != null
                WITH USER_MODE
                GROUP BY Timesheet_Entry__r.TimeSheet__r.Contact__c, 
                         Timesheet_Entry__r.TimeSheet__r.Job__c
            ]) {
                Id contactId = (Id)ar.get('contactId');
                Id jobId = (Id)ar.get('jobId');
                Decimal totalHours = (Decimal)ar.get('totalHours');
                
                String contactJobKey = contactId + '_' + jobId;
                contactJobManHoursMap.put(contactJobKey, totalHours);
            }

            // Update mobilization groups with contact-job specific man hours and calculate contact totals
            for (ContactWrapper contact : contactMap.values()) {
                Decimal contactTotalHours = 0.00;
                
                for (MobilizationGroupWrapper mobGroup : contact.mobilizationGroups) {
                    String key = contact.contactId + '_' + mobGroup.jobId;
                    if (contactJobManHoursMap.containsKey(key)) {
                        mobGroup.totalManHours = contactJobManHoursMap.get(key);
                    } else {
                        mobGroup.totalManHours = 0.00;
                    }
                    contactTotalHours += mobGroup.totalManHours;
                }
                
                contact.totalManHours = contactTotalHours;
            }

            // Fetch related timesheet entries for these contacts
            if (!contactIds.isEmpty()) {
                List<Timesheet_Entry_Item__c> timesheetEntryItems = [
                    SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Cost_Code__c, Cost_Code__r.Name,
                           Travel_Time__c, Per_Diem__c, Total_Time__c, Premium__c,
                           Timesheet_Entry__r.TimeSheet__r.Contact__c, 
                           Timesheet_Entry__r.TimeSheet__r.Job__c, 
                           Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,
                           Timesheet_Entry__r.TimeSheet__r.Job__r.Name
                    FROM Timesheet_Entry_Item__c
                    WHERE Timesheet_Entry__r.TimeSheet__r.Contact__c IN :contactIds
                    AND Timesheet_Entry__r.TimeSheet__r.Job__c IN :jobIds
                    AND Clock_In_Date__c >= :customStartDate
                    AND Clock_In_Date__c <= :customEndDate
                    AND Clock_In_Date__c != null
                    WITH USER_MODE
                    ORDER BY Clock_In_Time__c DESC
                ];

                
                // Group timesheet entries by contact
                for (Timesheet_Entry_Item__c item : timesheetEntryItems) {
                    if (contactMap.containsKey(item.Timesheet_Entry__r.TimeSheet__r.Contact__c)) {
                        TimesheetEntryWrapper entryWrapper = new TimesheetEntryWrapper();
                        entryWrapper.entryId = item.Id;
                        entryWrapper.clockInTime = item.Clock_In_Time__c.addSeconds(userTz.getOffset(item.Clock_In_Time__c)/1000);
                        entryWrapper.clockOutTime = item.Clock_Out_Time__c != null ? 
                            item.Clock_Out_Time__c.addSeconds(userTz.getOffset(item.Clock_Out_Time__c)/1000) : null;
                        entryWrapper.jobId = item.Timesheet_Entry__r.TimeSheet__r.Job__c;
                        entryWrapper.jobName = item.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c;
                        entryWrapper.jobNumber = item.Timesheet_Entry__r.TimeSheet__r.Job__r.Name;
                        entryWrapper.costCode = item.Cost_Code__r?.Name;
                        entryWrapper.workHours = item.Total_Time__c != null ? item.Total_Time__c : 0.00;
                        entryWrapper.travelTime = item.Travel_Time__c != null ? item.Travel_Time__c : 0.00;
                        entryWrapper.perDiem = item.Per_Diem__c != null ? Integer.valueOf(item.Per_Diem__c) : 0;
                        entryWrapper.totalTime = (entryWrapper.workHours != null ? entryWrapper.workHours : 0) + 
                                               (entryWrapper.travelTime != null ? entryWrapper.travelTime : 0);
                        entryWrapper.premium = item.Premium__c != null ? item.Premium__c : false;
                        
                        contactMap.get(item.Timesheet_Entry__r.TimeSheet__r.Contact__c).timesheetEntries.add(entryWrapper);
                    }
                }
            }

            System.debug('contactMap: ' + contactMap);
            
            return contactMap.values();
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'getAllContactsWithDetails','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while fetching data.',  'apiResponse' => null});
            return new List<ContactWrapper>();
        }
    }

    // Wrapper classes
    public class ContactWrapper {
        @AuraEnabled public Id contactId { get; set; }
        @AuraEnabled public String contactName { get; set; }
        @AuraEnabled public String developerName { get; set; }
        @AuraEnabled public Boolean canClockInOut { get; set; }
        @AuraEnabled public String email { get; set; }
        @AuraEnabled public String phone { get; set; }
        @AuraEnabled public Decimal totalManHours { get; set; }
        @AuraEnabled public List<MobilizationGroupWrapper> mobilizationGroups { get; set; }
        @AuraEnabled public List<TimesheetEntryWrapper> timesheetEntries { get; set; }
        @AuraEnabled public Boolean showMobilizationDetails { get; set; }
    }

    public class MobilizationGroupWrapper {
        @AuraEnabled public Id mobilizationId { get; set; }
        @AuraEnabled public Id jobId { get; set; }
        @AuraEnabled public String jobName { get; set; }
        @AuraEnabled public String jobNumber { get; set; }
        @AuraEnabled public String jobAddress { get; set; }
        @AuraEnabled public String jobDescription { get; set; }
        @AuraEnabled public String jobStatus { get; set; }
        @AuraEnabled public DateTime startDate { get; set; }
        @AuraEnabled public DateTime endDate { get; set; }
        @AuraEnabled public Decimal totalManHours { get; set; }
    }

    public class TimesheetEntryWrapper {
        @AuraEnabled public Id entryId { get; set; }
        @AuraEnabled public DateTime clockInTime { get; set; }
        @AuraEnabled public DateTime clockOutTime { get; set; }
        @AuraEnabled public Id jobId { get; set; }
        @AuraEnabled public String jobName { get; set; }
        @AuraEnabled public String jobNumber { get; set; }
        @AuraEnabled public String costCode { get; set; }
        @AuraEnabled public Decimal workHours { get; set; }
        @AuraEnabled public Decimal travelTime { get; set; }
        @AuraEnabled public Integer perDiem { get; set; }
        @AuraEnabled public Decimal totalTime { get; set; }
        @AuraEnabled public Boolean premium { get; set; }
    }
}