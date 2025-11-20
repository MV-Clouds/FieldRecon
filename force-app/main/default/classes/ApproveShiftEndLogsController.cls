/**
* Class Name: ApproveShiftEndLogsController
* @description: Controller for Approve Shift End Logs Component
* Created Date: 18 November 2025
**/
public with sharing class ApproveShiftEndLogsController {
    
    /**
     * @description: Method to get log entries based on date and status filters
     * @param dateFilter: String filter option (last7days, last15days, last30days, alltime)
     * @param statusFilter: String filter option (All, Pending, Approved, Auto-Approved, Rejected)
     * @return: List<LogEntryWrapper> - List of log entry records
     */
    @AuraEnabled
    public static List<LogEntryWrapper> getUnapprovedLogEntries(String dateFilter, String statusFilter) {
        try {
            List<LogEntryWrapper> result = new List<LogEntryWrapper>();
            
            // Calculate date range based on filter
            Date startDate;
            Date endDate = Date.today();
            
            if (dateFilter == 'last7days') {
                startDate = Date.today().addDays(-7);
            } else if (dateFilter == 'last15days') {
                startDate = Date.today().addDays(-15);
            } else if (dateFilter == 'last30days') {
                startDate = Date.today().addDays(-30);
            } else if (dateFilter == 'alltime') {
                startDate = Date.newInstance(2000, 1, 1); // Set to a far past date
            }
            
            // Build query with status filter
            String query = 'SELECT Id, Name, wfrecon__Exceptions__c, wfrecon__Job__c, wfrecon__Job__r.Id, wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Job__r.Name, ' +
                          'wfrecon__Mobilization__c, wfrecon__Notes_to_Office__c, wfrecon__Plan_for_Tomorrow__c, ' +
                          'wfrecon__Status__c, wfrecon__Travel_Log_Complete__c, wfrecon__Work_Performed_Date__c, ' +
                          'CreatedDate, CreatedBy.Name ' +
                          'FROM wfrecon__Log_Entry__c WHERE ';
            
            // Add status filter
            if (String.isNotBlank(statusFilter) && statusFilter != 'All') {
                query += 'wfrecon__Status__c = \'' + String.escapeSingleQuotes(statusFilter) + '\'';
            } else {
                query += 'wfrecon__Status__c IN (\'Pending\', \'Approved\', \'Auto-Approved\', \'Rejected\')';
            }
            
            if (startDate != null) {
                query += ' AND wfrecon__Work_Performed_Date__c >= :startDate';
            }
            
            query += ' ORDER BY wfrecon__Work_Performed_Date__c DESC';
            
            List<wfrecon__Log_Entry__c> logEntries = Database.query(query);
            
            // Process results
            for (wfrecon__Log_Entry__c log : logEntries) {
                LogEntryWrapper wrapper = new LogEntryWrapper();
                wrapper.Id = log.Id;
                wrapper.entryNumber = log.Name;
                wrapper.jobId = log.wfrecon__Job__r.Id;
                wrapper.jobNumber = log.wfrecon__Job__c != null ? log.wfrecon__Job__r.Name : '--';
                wrapper.jobName = log.wfrecon__Job__c != null ? log.wfrecon__Job__r.wfrecon__Job_Name__c : '--';
                wrapper.submittedDate = log.wfrecon__Work_Performed_Date__c != null ? 
                                       log.wfrecon__Work_Performed_Date__c.format() : '--';
                wrapper.submittedBy = log.CreatedBy.Name;
                wrapper.status = log.wfrecon__Status__c;
                
                result.add(wrapper);
            }
            
            return result;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching log entries: ' + e.getMessage());
        }
    }
    
    /**
     * @description: Method to get detailed log entry data for approval modal
     * @param logEntryId: Id of the log entry
     * @return: LogEntryDetails - Detailed log entry data with timesheet entries, location processes, and attachments
     */
    @AuraEnabled
    public static LogEntryDetails getLogEntryDetails(Id logEntryId) {
        try {
            LogEntryDetails details = new LogEntryDetails();
            
            // Fetch log entry with all fields
            wfrecon__Log_Entry__c logEntry = [
                SELECT Id, Name, wfrecon__Work_Performed__c, wfrecon__Plan_for_Tomorrow__c,
                       wfrecon__Exceptions__c, wfrecon__Notes_to_Office__c, wfrecon__Approval_Data__c,
                       wfrecon__Status__c, wfrecon__Job__c, wfrecon__Job__r.Name, wfrecon__Job__r.wfrecon__Job_Name__c,
                       wfrecon__Work_Performed_Date__c, CreatedBy.Name, CreatedDate
                FROM wfrecon__Log_Entry__c
                WHERE Id = :logEntryId
                LIMIT 1
            ];
            
            details.Id = logEntry.Id;
            details.entryNumber = logEntry.Name;
            details.jobNumber = logEntry.wfrecon__Job__r.Name;
            details.jobName = logEntry.wfrecon__Job__r.wfrecon__Job_Name__c;
            details.workPerformed = logEntry.wfrecon__Work_Performed__c;
            details.planForTomorrow = logEntry.wfrecon__Plan_for_Tomorrow__c;
            details.exceptions = logEntry.wfrecon__Exceptions__c;
            details.notesToOffice = logEntry.wfrecon__Notes_to_Office__c;
            details.status = logEntry.wfrecon__Status__c;
            details.submittedBy = logEntry.CreatedBy.Name;
            details.submittedDate = logEntry.wfrecon__Work_Performed_Date__c != null ? 
                                   logEntry.wfrecon__Work_Performed_Date__c.format() : '';
            
            // Parse location process approval data from Log_Entry__c.Approval_Data__c
            details.locationProcesses = new List<LocationProcessWrapper>();
            if (String.isNotBlank(logEntry.wfrecon__Approval_Data__c)) {
                List<Object> approvalList = (List<Object>) JSON.deserializeUntyped(logEntry.wfrecon__Approval_Data__c);
                for (Object obj : approvalList) {
                    Map<String, Object> dataMap = (Map<String, Object>) obj;
                    LocationProcessWrapper lpw = new LocationProcessWrapper();
                    lpw.id = (String) dataMap.get('id');
                    lpw.oldValue = dataMap.get('oldValue') != null ? Integer.valueOf(dataMap.get('oldValue')) : 0;
                    lpw.newValue = dataMap.get('newValue') != null ? Integer.valueOf(dataMap.get('newValue')) : 0;
                    lpw.status = 'Pending'; // Default status
                    details.locationProcesses.add(lpw);
                }
                
                // Fetch location process names
                if (!details.locationProcesses.isEmpty()) {
                    Set<Id> lpIds = new Set<Id>();
                    for (LocationProcessWrapper lpw : details.locationProcesses) {
                        if (String.isNotBlank(lpw.id)) {
                            lpIds.add(lpw.id);
                        }
                    }
                    
                    Map<Id, Location_Process__c> lpMap = new Map<Id, Location_Process__c>([
                        SELECT Id, Name, Scope_Entry_Process__r.Process_Name__c, Location__r.Name
                        FROM Location_Process__c
                        WHERE Id IN :lpIds
                    ]);
                    
                    for (LocationProcessWrapper lpw : details.locationProcesses) {
                        if (lpMap.containsKey(lpw.id)) {
                            lpw.name = lpMap.get(lpw.id).Scope_Entry_Process__r.Process_Name__c;
                            lpw.locationProcessName = lpMap.get(lpw.id).Location__r.Name;
                        }
                    }
                }
            }
            
            // Fetch timesheet entries with approval data
            details.timesheetEntries = new List<TimesheetEntryWrapper>();
            List<Timesheet_Entry__c> tsEntries = [
                SELECT Id, Name, Approval_Data__c, Status__c,
                       TimeSheet__c, TimeSheet__r.Contact__c, TimeSheet__r.Contact__r.Name,
                       (SELECT Id, Name, Approval_Data__c, Status__c,
                               Cost_Code__c, Cost_Code__r.Name,
                               Clock_In_Time__c, Clock_Out_Time__c,
                               Clock_In_Date__c, Premium__c
                        FROM Timesheet_Entry_Items__r)
                FROM Timesheet_Entry__c
                WHERE TimeSheet__r.Job__c = :logEntry.wfrecon__Job__c
                AND wfrecon__Status__c = 'Pending'
            ];
            
            for (Timesheet_Entry__c ts : tsEntries) {
                TimesheetEntryWrapper tsw = new TimesheetEntryWrapper();
                tsw.id = ts.Id;
                tsw.name = ts.Name;
                tsw.memberName = ts.TimeSheet__r.Contact__c != null ? ts.TimeSheet__r.Contact__r.Name : '';
                tsw.status = ts.Status__c;
                tsw.approvalFields = new List<ApprovalFieldWrapper>();
                
                // Parse timesheet entry approval data
                if (String.isNotBlank(ts.Approval_Data__c)) {
                    List<Object> approvalList = (List<Object>) JSON.deserializeUntyped(ts.Approval_Data__c);
                    for (Object obj : approvalList) {
                        Map<String, Object> dataMap = (Map<String, Object>) obj;
                        ApprovalFieldWrapper afw = new ApprovalFieldWrapper();
                        afw.fieldApiName = (String) dataMap.get('fieldApiName');
                        afw.oldValue = dataMap.get('oldValue') != null ? String.valueOf(dataMap.get('oldValue')) : '';
                        afw.newValue = dataMap.get('newValue') != null ? String.valueOf(dataMap.get('newValue')) : '';
                        afw.recordType = 'Timesheet_Entry';
                        afw.recordId = ts.Id;
                        tsw.approvalFields.add(afw);
                    }
                }
                
                // Process timesheet entry items
                tsw.items = new List<TimesheetEntryItemWrapper>();
                for (Timesheet_Entry_Item__c item : ts.Timesheet_Entry_Items__r) {
                    TimesheetEntryItemWrapper itemw = new TimesheetEntryItemWrapper();
                    itemw.id = item.Id;
                    itemw.name = item.Name;
                    itemw.costCode = item.Cost_Code__c != null ? item.Cost_Code__r.Name : '';
                    itemw.status = item.Status__c;
                    itemw.approvalFields = new List<ApprovalFieldWrapper>();
                    
                    // Parse item approval data
                    if (String.isNotBlank(item.Approval_Data__c)) {
                        List<Object> approvalList = (List<Object>) JSON.deserializeUntyped(item.Approval_Data__c);
                        for (Object obj : approvalList) {
                            Map<String, Object> dataMap = (Map<String, Object>) obj;
                            ApprovalFieldWrapper afw = new ApprovalFieldWrapper();
                            afw.fieldApiName = (String) dataMap.get('fieldApiName');
                            afw.oldValue = dataMap.get('oldValue') != null ? String.valueOf(dataMap.get('oldValue')) : '';
                            afw.newValue = dataMap.get('newValue') != null ? String.valueOf(dataMap.get('newValue')) : '';
                            afw.recordType = 'Timesheet_Entry_Item';
                            afw.recordId = item.Id;
                            itemw.approvalFields.add(afw);
                        }
                    }
                    
                    tsw.items.add(itemw);
                }
                
                details.timesheetEntries.add(tsw);
            }
            
            // Fetch attached files/images
            details.attachments = new List<AttachmentWrapper>();
            List<ContentDocumentLink> cdLinks = [
                SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.FileExtension,
                       ContentDocument.ContentSize, ContentDocument.CreatedDate
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :logEntryId
            ];
            
            for (ContentDocumentLink cdl : cdLinks) {
                AttachmentWrapper aw = new AttachmentWrapper();
                aw.id = cdl.ContentDocumentId;
                aw.title = cdl.ContentDocument.Title;
                aw.fileExtension = cdl.ContentDocument.FileExtension;
                aw.fileSize = cdl.ContentDocument.ContentSize;
                aw.isImage = isImageFile(cdl.ContentDocument.FileExtension);
                details.attachments.add(aw);
            }
            
            return details;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching log entry details: ' + e.getMessage());
        }
    }
    
    /**
     * @description: Helper method to check if file is an image
     * @param extension: File extension
     * @return: Boolean indicating if file is an image
     */
    private static Boolean isImageFile(String extension) {
        Set<String> imageExtensions = new Set<String>{'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'};
        return extension != null && imageExtensions.contains(extension.toLowerCase());
    }
    
    /**
     * @description: Delete a content document
     * @param contentDocumentId: ID of the content document to delete
     */
    @AuraEnabled
    public static void deleteContentDocument(Id contentDocumentId) {
        try {
            ContentDocument doc = [SELECT Id FROM ContentDocument WHERE Id = :contentDocumentId LIMIT 1];
            delete doc;
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting content document: ' + e.getMessage());
        }
    }
    
    /**
     * @description: Wrapper class for Log Entry data
     */
    public class LogEntryWrapper {
        @AuraEnabled public Id Id { get; set; }
        @AuraEnabled public String entryNumber { get; set; }
        @AuraEnabled public Id jobId { get; set; }
        @AuraEnabled public String jobName { get; set; }
        @AuraEnabled public String jobNumber { get; set; }
        @AuraEnabled public String submittedDate { get; set; }
        @AuraEnabled public String submittedBy { get; set; }
        @AuraEnabled public String status { get; set; }
    }
    
    /**
     * @description: Wrapper class for detailed log entry data
     */
    public class LogEntryDetails {
        @AuraEnabled public Id Id { get; set; }
        @AuraEnabled public String entryNumber { get; set; }
        @AuraEnabled public String jobNumber { get; set; }
        @AuraEnabled public String jobName { get; set; }
        @AuraEnabled public String workPerformed { get; set; }
        @AuraEnabled public String planForTomorrow { get; set; }
        @AuraEnabled public String exceptions { get; set; }
        @AuraEnabled public String notesToOffice { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String submittedBy { get; set; }
        @AuraEnabled public String submittedDate { get; set; }
        @AuraEnabled public List<TimesheetEntryWrapper> timesheetEntries { get; set; }
        @AuraEnabled public List<LocationProcessWrapper> locationProcesses { get; set; }
        @AuraEnabled public List<AttachmentWrapper> attachments { get; set; }
    }
    
    /**
     * @description: Wrapper class for timesheet entry
     */
    public class TimesheetEntryWrapper {
        @AuraEnabled public Id id { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String memberName { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public List<ApprovalFieldWrapper> approvalFields { get; set; }
        @AuraEnabled public List<TimesheetEntryItemWrapper> items { get; set; }
    }
    
    /**
     * @description: Wrapper class for timesheet entry item
     */
    public class TimesheetEntryItemWrapper {
        @AuraEnabled public Id id { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String costCode { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public List<ApprovalFieldWrapper> approvalFields { get; set; }
    }
    
    /**
     * @description: Wrapper class for approval field changes
     */
    public class ApprovalFieldWrapper {
        @AuraEnabled public String fieldApiName { get; set; }
        @AuraEnabled public String oldValue { get; set; }
        @AuraEnabled public String newValue { get; set; }
        @AuraEnabled public String recordType { get; set; }
        @AuraEnabled public Id recordId { get; set; }
    }
    
    /**
     * @description: Wrapper class for location process
     */
    public class LocationProcessWrapper {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String locationProcessName { get; set; }
        @AuraEnabled public Integer oldValue { get; set; }
        @AuraEnabled public Integer newValue { get; set; }
        @AuraEnabled public String status { get; set; }
    }
    
    /**
     * @description: Wrapper class for attachments
     */
    public class AttachmentWrapper {
        @AuraEnabled public Id id { get; set; }
        @AuraEnabled public String title { get; set; }
        @AuraEnabled public String fileExtension { get; set; }
        @AuraEnabled public Integer fileSize { get; set; }
        @AuraEnabled public Boolean isImage { get; set; }
    }
}