public with sharing class TimeCardManagerController {
    
    public static TimeZone userTz = UserInfo.getTimeZone();

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
            System.debug('customStartDate in apex: ' + customStartDate);
            System.debug('customEndDate in apex: ' + customEndDate);
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

            // 1. Fetch mobilization members with their contacts and mobilization details
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

            // 2. Group data by contact
            Map<Id, ContactWrapper> contactMap = new Map<Id, ContactWrapper>();
            Set<Id> contactIds = new Set<Id>();
            Set<Id> mobilizationIds = new Set<Id>();

            for (Mobilization_Member__c member : mobilizationMembers) {
                contactIds.add(member.Contact__c);
                mobilizationIds.add(member.Mobilization__c);

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
                    
                    contactMap.put(member.Contact__c, wrapper);
                }

                // Add mobilization group data
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
                
                contactMap.get(member.Contact__c).mobilizationGroups.add(mobGroup);
            }

            // 3. Fetch related timesheet entries for these contacts
            if (!contactIds.isEmpty()) {
                List<Timesheet_Entry__c> timesheetEntries = [
                    SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Cost_Code__c, Cost_Code__r.Name,
                           Timesheet__r.Contact__c, Timesheet__r.Job__c, Timesheet__r.Job__r.Job_Name__c,
                           Timesheet__r.Job__r.Name
                    FROM Timesheet_Entry__c
                    WHERE Timesheet__r.Contact__c IN :contactIds
                    AND Clock_In_Time__c >= :startOfDay
                    AND Clock_In_Time__c <= :endOfDay
                    WITH USER_MODE
                    ORDER BY Clock_In_Time__c DESC
                ];
                
                // Group timesheet entries by contact
                for (Timesheet_Entry__c entry : timesheetEntries) {
                    if (contactMap.containsKey(entry.Timesheet__r.Contact__c)) {
                        TimesheetEntryWrapper entryWrapper = new TimesheetEntryWrapper();
                        entryWrapper.entryId = entry.Id;
                        entryWrapper.clockInTime = entry.Clock_In_Time__c;
                        entryWrapper.clockOutTime = entry.Clock_Out_Time__c;
                        entryWrapper.jobId = entry.Timesheet__r.Job__c;
                        entryWrapper.jobName = entry.Timesheet__r.Job__r.Job_Name__c;
                        entryWrapper.jobNumber = entry.Timesheet__r.Job__r.Name;
                        
                        contactMap.get(entry.Timesheet__r.Contact__c).timesheetEntries.add(entryWrapper);
                    }
                }
            }
            
            return contactMap.values();
            
        } catch (Exception e) {
            System.debug('Error in getAllContactsWithDetails: ' + e.getMessage());
            throw new AuraHandledException('Error fetching contact details: ' + e.getMessage());
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
        @AuraEnabled public List<MobilizationGroupWrapper> mobilizationGroups { get; set; }
        @AuraEnabled public List<TimesheetEntryWrapper> timesheetEntries { get; set; }
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
    }

    public class TimesheetEntryWrapper {
        @AuraEnabled public Id entryId { get; set; }
        @AuraEnabled public DateTime clockInTime { get; set; }
        @AuraEnabled public DateTime clockOutTime { get; set; }
        @AuraEnabled public Id jobId { get; set; }
        @AuraEnabled public String jobName { get; set; }
        @AuraEnabled public String jobNumber { get; set; }
    }
}