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

            if (customStartDate != null && customEndDate != null) {
                startOfDay = DateTime.newInstance(customStartDate, Time.newInstance(0,0,0,0));
                endOfDay   = DateTime.newInstance(customEndDate, Time.newInstance(23,59,59,999));
            } else {
                Date today = Date.today();
                startOfDay = DateTime.newInstance(today, Time.newInstance(0,0,0,0));
                endOfDay   = DateTime.newInstance(today, Time.newInstance(23,59,59,999));
            }

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
                AND Mobilization__r.Start_Date__c <= :endOfDay
                AND (Mobilization__r.End_Date__c = null OR Mobilization__r.End_Date__c >= :startOfDay)
                WITH USER_MODE
            ];

            Map<Id, ContactWrapper> contactMap = new Map<Id, ContactWrapper>();
            Set<Id> contactIds = new Set<Id>();
            Set<Id> jobIds = new Set<Id>();

            // Create a global map to track unique mobilizations per contact to prevent duplicates from all sources
            Map<String, MobilizationGroupWrapper> globalUniqueMobilizationsMap = new Map<String, MobilizationGroupWrapper>();
            
            for (Mobilization_Member__c member : mobilizationMembers) {
                contactIds.add(member.Contact__c);
                jobIds.add(member.Mobilization__r.Job__c);

                if (!contactMap.containsKey(member.Contact__c)) {
                    ContactWrapper cw = new ContactWrapper();
                    cw.contactId = member.Contact__c;
                    cw.contactName = member.Contact__r.Name;
                    cw.canClockInOut = member.Contact__r.Can_Clock_In_Out__c;
                    cw.email = member.Contact__r.Email;
                    cw.phone = member.Contact__r.Phone;
                    cw.mobilizationGroups = new List<MobilizationGroupWrapper>();
                    cw.timesheetEntries = new List<TimesheetEntryWrapper>();
                    cw.totalManHours = 0;
                    cw.totalManHoursWithTravel = 0;
                    contactMap.put(member.Contact__c, cw);
                }

                // Create unique key for contact + job combination to prevent duplicates across different sources
                String uniqueKey = member.Contact__c + '_' + member.Mobilization__r.Job__c;
                
                if (!globalUniqueMobilizationsMap.containsKey(uniqueKey)) {
                    MobilizationGroupWrapper mg = new MobilizationGroupWrapper();
                    mg.mobilizationId = member.Mobilization__c; // Individual mobilization ID
                    mg.mobilizationGroupId = null; // Will be set if we have group information
                    mg.jobId = member.Mobilization__r.Job__c;
                    mg.jobName = member.Mobilization__r.Job__r.Job_Name__c;
                    mg.jobNumber = member.Mobilization__r.Job__r.Name;
                    mg.jobAddress = member.Mobilization__r.Job__r.Address__c;
                    mg.jobDescription = member.Mobilization__r.Job__r.Description__c;
                    mg.startDate = member.Mobilization__r.Start_Date__c != null 
                        ? member.Mobilization__r.Start_Date__c
                        : null;
                    mg.endDate = member.Mobilization__r.End_Date__c != null 
                        ? member.Mobilization__r.End_Date__c
                        : null;
                    mg.totalManHours = 0;
                    mg.totalManHoursWithTravel = 0;
                    
                    globalUniqueMobilizationsMap.put(uniqueKey, mg);
                    contactMap.get(member.Contact__c).mobilizationGroups.add(mg);
                }
            }

            // Query Mobilization Groups and their associated Mobilizations
            List<Mobilization_Group__c> mobilizationGroups = [
                SELECT Id, Job__c, Job__r.Job_Name__c, Job__r.Name, Job__r.Address__c,
                       Job__r.Description__c, Job__r.Status__c,
                       (SELECT Id, Start_Date__c, End_Date__c FROM Mobilizations__r)
                FROM Mobilization_Group__c
                WHERE Job__c IN :jobIds
                WITH USER_MODE
            ];

            // Create a map of Mobilization Group to its Mobilizations
            Map<Id, List<Mobilization__c>> mobGroupToMobilizationsMap = new Map<Id, List<Mobilization__c>>();
            for (Mobilization_Group__c mobGroup : mobilizationGroups) {
                mobGroupToMobilizationsMap.put(mobGroup.Id, mobGroup.Mobilizations__r);
            }

            List<Timesheet__c> manualTimesheets = [
                SELECT Id, Contact__c, Mobilization_Group__c,
                       Mobilization_Group__r.Job__c,
                       Mobilization_Group__r.Job__r.Job_Name__c,
                       Mobilization_Group__r.Job__r.Name,
                       Mobilization_Group__r.Job__r.Address__c,
                       Mobilization_Group__r.Job__r.Description__c,
                       Mobilization_Group__r.Job__r.Status__c
                FROM Timesheet__c
                WHERE Contact__c != null
                AND CreatedDate >= :startOfDay 
                AND CreatedDate <= :endOfDay
                AND Mobilization_Group__c != null
                WITH USER_MODE
            ];

            Set<Id> manualContactIds = new Set<Id>();
            for (Timesheet__c ts : manualTimesheets) {
                manualContactIds.add(ts.Contact__c);
                contactIds.add(ts.Contact__c);
                jobIds.add(ts.Mobilization_Group__r.Job__c);
            }


            if (!manualContactIds.isEmpty()) {
                Map<Id, Contact> contactDetails = new Map<Id, Contact>([
                    SELECT Id, Name, RecordType.DeveloperName, Can_Clock_In_Out__c, Email, Phone 
                    FROM Contact WHERE Id IN :manualContactIds WITH USER_MODE
                ]);

                for (Timesheet__c ts : manualTimesheets) {
                    if (!contactMap.containsKey(ts.Contact__c)) {
                        Contact c = contactDetails.get(ts.Contact__c);
                        if (c == null){
                            continue;
                        }

                        ContactWrapper cw = new ContactWrapper();
                        cw.contactId = c.Id;
                        cw.contactName = c.Name;
                        cw.canClockInOut = c.Can_Clock_In_Out__c;
                        cw.email = c.Email;
                        cw.phone = c.Phone;
                        cw.mobilizationGroups = new List<MobilizationGroupWrapper>();
                        cw.timesheetEntries = new List<TimesheetEntryWrapper>();
                        cw.totalManHours = 0;
                        cw.totalManHoursWithTravel = 0;
                        contactMap.put(c.Id, cw);
                    }

                    // Use the same global unique key for contact + job combination
                    String globalUniqueKey = ts.Contact__c + '_' + ts.Mobilization_Group__r.Job__c;
                    
                    if (!globalUniqueMobilizationsMap.containsKey(globalUniqueKey)) {
                        // Create MobilizationGroupWrapper for the group
                        MobilizationGroupWrapper mg = new MobilizationGroupWrapper();
                        mg.mobilizationGroupId = ts.Mobilization_Group__c; // Store the group ID
                        
                        // Set mobilization ID from related mobilizations if available
                        if (mobGroupToMobilizationsMap.containsKey(ts.Mobilization_Group__c)) {
                            List<Mobilization__c> mobilizations = mobGroupToMobilizationsMap.get(ts.Mobilization_Group__c);
                            if (!mobilizations.isEmpty()) {
                                mg.mobilizationId = mobilizations[0].Id; // Use first mobilization ID
                                mg.startDate = mobilizations[0].Start_Date__c != null 
                                    ? mobilizations[0].Start_Date__c.addSeconds(userTz.getOffset(mobilizations[0].Start_Date__c)/1000)
                                    : null;
                                mg.endDate = mobilizations[0].End_Date__c != null 
                                    ? mobilizations[0].End_Date__c.addSeconds(userTz.getOffset(mobilizations[0].End_Date__c)/1000)
                                    : null;
                            } else {
                                mg.mobilizationId = ts.Mobilization_Group__c; 
                            }
                        } else {
                            mg.mobilizationId = ts.Mobilization_Group__c; 
                        }
                        
                        mg.jobId = ts.Mobilization_Group__r.Job__c;
                        mg.jobName = ts.Mobilization_Group__r.Job__r.Job_Name__c;
                        mg.jobNumber = ts.Mobilization_Group__r.Job__r.Name;
                        mg.jobAddress = ts.Mobilization_Group__r.Job__r.Address__c;
                        mg.jobDescription = ts.Mobilization_Group__r.Job__r.Description__c;
                        mg.totalManHours = 0;
                        mg.totalManHoursWithTravel = 0;
                        
                        globalUniqueMobilizationsMap.put(globalUniqueKey, mg);
                        contactMap.get(ts.Contact__c).mobilizationGroups.add(mg);
                    }
                }
            }

            Map<String, Decimal> contactJobManHoursMap = new Map<String, Decimal>();
            Map<String, Decimal> contactJobTravelTimeMap = new Map<String, Decimal>();

            // Get all timesheet hours with a single query
            for (AggregateResult ar : [
                SELECT Timesheet_Entry__r.TimeSheet__r.Contact__c contactId,
                       Timesheet_Entry__r.TimeSheet__r.Job__c timesheetJobId,
                       Timesheet_Entry__r.Mobilization__r.Job__c mobilizationJobId,
                       SUM(Total_Time__c) totalHours,
                       SUM(Travel_Time__c) travelTime
                FROM Timesheet_Entry_Item__c
                WHERE Timesheet_Entry__r.TimeSheet__r.Contact__c IN :contactIds
                AND Clock_In_Date__c >= :customStartDate
                AND Clock_In_Date__c <= :customEndDate
                WITH USER_MODE
                GROUP BY Timesheet_Entry__r.TimeSheet__r.Contact__c, 
                         Timesheet_Entry__r.TimeSheet__r.Job__c,
                         Timesheet_Entry__r.Mobilization__r.Job__c
            ]) {
                Id contactId = (Id)ar.get('contactId');
                Id timesheetJobId = (Id)ar.get('timesheetJobId');
                Id mobilizationJobId = (Id)ar.get('mobilizationJobId');
                Decimal totalHours = (Decimal)ar.get('totalHours');
                Decimal travelTime = (Decimal)ar.get('travelTime');
                
                // Use mobilization job if available, otherwise use timesheet job
                Id effectiveJobId = mobilizationJobId != null ? mobilizationJobId : timesheetJobId;
                
                if (effectiveJobId != null) {
                    String key = contactId + '_' + effectiveJobId;
                    Decimal existing = contactJobManHoursMap.containsKey(key) ? contactJobManHoursMap.get(key) : 0;
                    contactJobManHoursMap.put(key, existing + totalHours);
                    
                    Decimal existingTravel = contactJobTravelTimeMap.containsKey(key) ? contactJobTravelTimeMap.get(key) : 0;
                    contactJobTravelTimeMap.put(key, existingTravel + (travelTime != null ? travelTime : 0));
                    
                    // Debug logging
                    System.debug('ContactJobHours - Contact: ' + contactId + ', Job: ' + effectiveJobId + 
                               ', Hours: ' + totalHours + ', Travel: ' + travelTime + ', Total for key: ' + (existing + totalHours));
                }
            }
            
            System.debug('Final contactJobManHoursMap: ' + contactJobManHoursMap);
            System.debug('Final contactJobTravelTimeMap: ' + contactJobTravelTimeMap);

            for (ContactWrapper contact : contactMap.values()) {
                Decimal contactTotalHours = 0;
                Decimal contactTotalHoursWithTravel = 0;
                System.debug('Processing contact: ' + contact.contactName + ' (' + contact.contactId + ')');
                
                for (MobilizationGroupWrapper mob : contact.mobilizationGroups) {
                    String key = contact.contactId + '_' + mob.jobId;
                    if (contactJobManHoursMap.containsKey(key)) {
                        mob.totalManHours = contactJobManHoursMap.get(key);
                        System.debug('  Job: ' + mob.jobName + ' (' + mob.jobId + ') - Hours: ' + mob.totalManHours);
                    } else {
                        System.debug('  Job: ' + mob.jobName + ' (' + mob.jobId + ') - No hours found for key: ' + key);
                    }
                    
                    Decimal travelTime = contactJobTravelTimeMap.containsKey(key) ? contactJobTravelTimeMap.get(key) : 0;
                    mob.totalManHoursWithTravel = mob.totalManHours + travelTime;
                    
                    contactTotalHours += mob.totalManHours;
                    contactTotalHoursWithTravel += mob.totalManHoursWithTravel;
                }
                contact.totalManHours = contactTotalHours;
                contact.totalManHoursWithTravel = contactTotalHoursWithTravel;
                System.debug('  Contact Total Hours: ' + contactTotalHours);
                System.debug('  Contact Total Hours With Travel: ' + contactTotalHoursWithTravel);
            }

            if (!contactIds.isEmpty()) {
                List<Timesheet_Entry_Item__c> entryItems = [
                    SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Cost_Code__r.Name,
                           Travel_Time__c, Per_Diem__c, Total_Time__c, Premium__c,
                           Timesheet_Entry__r.TimeSheet__r.Contact__c,
                           Timesheet_Entry__r.TimeSheet__r.Job__c,
                           Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,
                           Timesheet_Entry__r.TimeSheet__r.Job__r.Name,
                           Timesheet_Entry__r.Mobilization__r.Job__c,
                           Timesheet_Entry__r.Mobilization__r.Job__r.Job_Name__c
                    FROM Timesheet_Entry_Item__c
                    WHERE Timesheet_Entry__r.TimeSheet__r.Contact__c IN :contactIds
                    AND Clock_In_Date__c >= :customStartDate
                    AND Clock_In_Date__c <= :customEndDate
                    WITH USER_MODE
                    ORDER BY Clock_In_Time__c DESC
                ];

                for (Timesheet_Entry_Item__c item : entryItems) {
                    Id cId = item.Timesheet_Entry__r.TimeSheet__r.Contact__c;
                    if (!contactMap.containsKey(cId)) {
                        continue;
                    }

                    TimesheetEntryWrapper tw = new TimesheetEntryWrapper();
                    tw.entryId = item.Id;
                    tw.clockInTime = item.Clock_In_Time__c != null 
                        ? item.Clock_In_Time__c.addSeconds(userTz.getOffset(item.Clock_In_Time__c)/1000)
                        : null;
                    tw.clockOutTime = item.Clock_Out_Time__c != null 
                        ? item.Clock_Out_Time__c.addSeconds(userTz.getOffset(item.Clock_Out_Time__c)/1000)
                        : null;
                    tw.jobId = item.Timesheet_Entry__r.Mobilization__r.Job__c != null 
                        ? item.Timesheet_Entry__r.Mobilization__r.Job__c 
                        : item.Timesheet_Entry__r.TimeSheet__r.Job__c;
                    tw.jobName = item.Timesheet_Entry__r.Mobilization__r.Job__r.Job_Name__c != null 
                        ? item.Timesheet_Entry__r.Mobilization__r.Job__r.Job_Name__c 
                        : item.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c;
                    tw.jobNumber = item.Timesheet_Entry__r.TimeSheet__r.Job__r.Name;
                    tw.costCode = item.Cost_Code__r != null ? item.Cost_Code__r.Name : null;
                    tw.workHours = item.Total_Time__c != null ? item.Total_Time__c : 0;
                    tw.travelTime = item.Travel_Time__c != null ? item.Travel_Time__c : 0;
                    tw.perDiem = item.Per_Diem__c != null ? Integer.valueOf(item.Per_Diem__c) : 0;
                    tw.totalTime = item.Total_Time__c != null ? item.Total_Time__c : 0;
                    tw.premium = item.Premium__c != null ? item.Premium__c : false;
                    contactMap.get(cId).timesheetEntries.add(tw);
                }
            }

            return contactMap.values();

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getAllContactsWithDetails',
                'isApiException' => false,
                'exceptionObj' => e,
                'moreDetails' => 'Error fetching mobilization & manual timesheet data'
            });
            return new List<ContactWrapper>();
        }
    }

    public class ContactWrapper {
        @AuraEnabled public Id contactId { get; set; }
        @AuraEnabled public String contactName { get; set; }
        @AuraEnabled public Boolean canClockInOut { get; set; }
        @AuraEnabled public String email { get; set; }
        @AuraEnabled public String phone { get; set; }
        @AuraEnabled public Decimal totalManHours { get; set; }
        @AuraEnabled public Decimal totalManHoursWithTravel { get; set; }
        @AuraEnabled public List<MobilizationGroupWrapper> mobilizationGroups { get; set; }
        @AuraEnabled public List<TimesheetEntryWrapper> timesheetEntries { get; set; }
    }

    public class MobilizationGroupWrapper {
        @AuraEnabled public Id mobilizationGroupId { get; set; }
        @AuraEnabled public Id mobilizationId { get; set; }
        @AuraEnabled public Id jobId { get; set; }
        @AuraEnabled public String jobName { get; set; }
        @AuraEnabled public String jobNumber { get; set; }
        @AuraEnabled public String jobAddress { get; set; }
        @AuraEnabled public String jobDescription { get; set; }
        @AuraEnabled public DateTime startDate { get; set; }
        @AuraEnabled public DateTime endDate { get; set; }
        @AuraEnabled public Decimal totalManHours { get; set; }
        @AuraEnabled public Decimal totalManHoursWithTravel { get; set; }
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