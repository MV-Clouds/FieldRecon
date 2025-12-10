/**
* Class Name: ApproveShiftEndLogsController
* @description: Controller for Approve Shift End Logs Component
* Created Date: 18 November 2025
**/
public with sharing class ApproveShiftEndLogsController {
    
    /**
     * @description: Check if current user has access to view log entries
     * User has access if they are System Administrator or listed in wfrecon__Shift_End_Log_Configuration__c
     * @return: Boolean indicating if user has access
     */
    @AuraEnabled
    public static Map<String, Boolean> checkUserAccess() {
        try {
            Map<String, Boolean> accessMap = new Map<String, Boolean>();
            accessMap.put('hasAccess', false);
            accessMap.put('timesheetApprovalEnabled', false);

            String userId = UserInfo.getUserId();
            String profileName = [SELECT Id, Name FROM Profile WHERE Id = :UserInfo.getProfileId() LIMIT 1].Name;

            if (profileName == 'System Administrator') {
                accessMap.put('hasAccess', true);
            }

            List<wfrecon__Shift_End_Log_Configuration__c> approverMetadata = [SELECT wfrecon__Approvers_JSON__c, wfrecon__Timesheet_Entries_Approval_Feature__c FROM wfrecon__Shift_End_Log_Configuration__c WITH USER_MODE LIMIT 1];
            
            if (approverMetadata != null && !approverMetadata.isEmpty()) {
                wfrecon__Shift_End_Log_Configuration__c config = approverMetadata[0];

                accessMap.put('timesheetApprovalEnabled', config.wfrecon__Timesheet_Entries_Approval_Feature__c);

                if (String.isNotBlank(config.wfrecon__Approvers_JSON__c)) {
                    List<Object> approversList = (List<Object>) JSON.deserializeUntyped(config.wfrecon__Approvers_JSON__c);
                    
                    for (Object approverObj : approversList) {
                        String approverId = (String) approverObj;
                        if (approverId == userId) {
                            accessMap.put('hasAccess', true);
                            break;
                        }
                    }
                }
            }
            
            return accessMap;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ApproveShiftEndLogsController', 'methodName' => 'checkUserAccess', 'exceptionObj' => e, 'moreDetails' => e.getMessage()});
            return new Map<String, Boolean>{ 'hasAccess' => false, 'timesheetApprovalEnabled' => false};
        }
    }

    /**
     * @description: Method to get all pending log entries based on date filter
     * @param dateFilter: String filter option (last7days, last15days, last30days, alltime)
     * @return: LogEntryResponse - Response containing pending log entries
     */
    @AuraEnabled
    public static LogEntryResponse getUnapprovedLogEntries(String dateFilter) {
        try {
            LogEntryResponse response = new LogEntryResponse();
            List<LogEntryWrapper> result = new List<LogEntryWrapper>();
            
            // Calculate date range based on filter
            Date startDate;
            
            if (dateFilter == 'last7days') {
                startDate = Date.today().addDays(-7);
            } else if (dateFilter == 'last15days') {
                startDate = Date.today().addDays(-15);
            } else if (dateFilter == 'last30days') {
                startDate = Date.today().addDays(-30);
            } else if (dateFilter == 'alltime') {
                startDate = null;
            }
            
            // Build query - fetch only PENDING log entries
            String query = 'SELECT Id, Name, wfrecon__Exceptions__c, wfrecon__Job__c, wfrecon__Job__r.Id, wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Job__r.Name, ' +
                          'wfrecon__Mobilization__c, wfrecon__Notes_to_Office__c, wfrecon__Plan_for_Tomorrow__c, ' +
                          'wfrecon__Status__c, wfrecon__Travel_Log_Complete__c, wfrecon__Work_Performed_Date__c, ' +
                          'CreatedDate, CreatedBy.Name ' +
                          'FROM wfrecon__Log_Entry__c WHERE wfrecon__Status__c = \'Pending\'';
            
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
            
            response.entries = result;
            return response;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ApproveShiftEndLogsController', 'methodName' => 'getUnapprovedLogEntries', 'exceptionObj' => e, 'moreDetails' => e.getMessage()});
            LogEntryResponse errorResponse = new LogEntryResponse();
            errorResponse.entries = new List<LogEntryWrapper>();
            return errorResponse;
        }
    }
    
    /**
     * @description: Method to get detailed log entry data for approval modal
     * Parses new Approval_Data__c JSON structure containing both timesheet and location process changes
     * @param logEntryId: Id of the log entry
     * @return: LogEntryDetails - Detailed log entry data with timesheet entries, location processes, and attachments
     */
    @AuraEnabled
    public static LogEntryDetails getLogEntryDetails(Id logEntryId) {
        try {
            LogEntryDetails details = new LogEntryDetails();
            
            // Fetch log entry with all fields
            wfrecon__Log_Entry__c logEntry = [SELECT Id, Name, wfrecon__Work_Performed__c, wfrecon__Plan_for_Tomorrow__c,
                                                wfrecon__Exceptions__c, wfrecon__Notes_to_Office__c, wfrecon__Approval_Data__c,
                                                wfrecon__Status__c, wfrecon__Job__c, wfrecon__Job__r.Name, wfrecon__Job__r.wfrecon__Job_Name__c,
                                                wfrecon__Work_Performed_Date__c, CreatedBy.Name, CreatedDate
                                                FROM wfrecon__Log_Entry__c WHERE Id = :logEntryId WITH USER_MODE LIMIT 1];
            
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
            details.jobId = logEntry.wfrecon__Job__c;

            details.locationProcesses = new List<LocationProcessWrapper>();
            details.timesheetEntries = new List<TimesheetEntryWrapper>();
            
            // Fetch all location processes for the job
            List<wfrecon__Location_Process__c> allLocationProcesses = [
                SELECT Id, Name, wfrecon__Process_Name__c, wfrecon__Completed_Percentage__c, 
                       wfrecon__Location__c, wfrecon__Location__r.Name, wfrecon__Sequence__c
                FROM wfrecon__Location_Process__c 
                WHERE wfrecon__Location__r.wfrecon__Job__c = :logEntry.wfrecon__Job__c
                WITH USER_MODE
                ORDER BY wfrecon__Location__r.Name ASC, wfrecon__Sequence__c ASC NULLS LAST, CreatedDate ASC
            ];
            
            // Parse approval data to find changes
            Map<String, Map<String, Object>> changesMap = new Map<String, Map<String, Object>>();
            if (String.isNotBlank(logEntry.wfrecon__Approval_Data__c)) {
                Map<String, Object> approvalData = (Map<String, Object>) JSON.deserializeUntyped(logEntry.wfrecon__Approval_Data__c);
                
                // Parse location process changes - all data comes from JSON
                if (approvalData.containsKey('locationProcessChanges')) {
                    List<Object> lpChanges = (List<Object>) approvalData.get('locationProcessChanges');
                    
                    for (Object lpObj : lpChanges) {
                        Map<String, Object> lpData = (Map<String, Object>) lpObj;
                        String processId = (String) lpData.get('id');
                        changesMap.put(processId, lpData);
                    }
                }
            }
            
            // Add all location processes (both changed and unchanged)
            for (wfrecon__Location_Process__c lp : allLocationProcesses) {
                LocationProcessWrapper lpw = new LocationProcessWrapper();
                lpw.id = lp.Id;
                lpw.name = String.isNotBlank(lp.wfrecon__Process_Name__c) ? lp.wfrecon__Process_Name__c : lp.Name;
                lpw.locationId = lp.wfrecon__Location__c;
                lpw.locationName = lp.wfrecon__Location__r.Name;
                lpw.sequence = lp.wfrecon__Sequence__c != null ? Integer.valueOf(lp.wfrecon__Sequence__c) : 0;
                lpw.currentValue = lp.wfrecon__Completed_Percentage__c != null ? Integer.valueOf(lp.wfrecon__Completed_Percentage__c) : 0;
                
                // Check if this process has pending changes
                if (changesMap.containsKey(lp.Id)) {
                    Map<String, Object> changeData = changesMap.get(lp.Id);
                    lpw.oldValue = changeData.get('oldValue') != null ? Integer.valueOf(changeData.get('oldValue')) : lpw.currentValue;
                    lpw.newValue = changeData.get('newValue') != null ? Integer.valueOf(changeData.get('newValue')) : lpw.currentValue;
                    lpw.hasChanges = true;
                    lpw.status = 'Pending';
                } else {
                    lpw.oldValue = lpw.currentValue;
                    lpw.newValue = lpw.currentValue;
                    lpw.hasChanges = false;
                    lpw.status = null;
                }
                
                details.locationProcesses.add(lpw);
            }
            
            // Parse timesheet entry changes - all data comes from JSON
            if (String.isNotBlank(logEntry.wfrecon__Approval_Data__c)) {
                Map<String, Object> approvalData = (Map<String, Object>) JSON.deserializeUntyped(logEntry.wfrecon__Approval_Data__c);
                if (approvalData.containsKey('timesheetEntryChanges')) {
                    Map<String, Object> tsChangesMap = (Map<String, Object>) approvalData.get('timesheetEntryChanges');
                    
                    for (String tsId : tsChangesMap.keySet()) {
                        Map<String, Object> tsData = (Map<String, Object>) tsChangesMap.get(tsId);
                        
                        TimesheetEntryWrapper tsWrapper = new TimesheetEntryWrapper();
                        tsWrapper.id = tsId;
                        tsWrapper.memberName = (String) tsData.get('contactName'); // Name comes from JSON
                        tsWrapper.name = tsId; // Use ID as name (or add 'name' field to JSON if needed)
                        tsWrapper.status = 'Pending'; // Default status
                        tsWrapper.approvalFields = new List<ApprovalFieldWrapper>();
                        tsWrapper.items = new List<TimesheetEntryItemWrapper>(); // No separate items needed
                        
                        // Parse changes array
                        if (tsData.containsKey('changes')) {
                            List<Object> changes = (List<Object>) tsData.get('changes');
                            for (Object changeObj : changes) {
                                Map<String, Object> change = (Map<String, Object>) changeObj;
                                ApprovalFieldWrapper field = new ApprovalFieldWrapper();
                                field.fieldApiName = (String) change.get('fieldApiName');
                                field.oldValue = change.get('oldValue') != null ? String.valueOf(change.get('oldValue')) : null;
                                field.newValue = change.get('newValue') != null ? String.valueOf(change.get('newValue')) : null;
                                field.recordType = 'wfrecon__Timesheet_Entry__c';
                                field.recordId = tsId;
                                tsWrapper.approvalFields.add(field);
                            }
                        }
                        
                        details.timesheetEntries.add(tsWrapper);
                    }
                }
            }
            
            // Fetch attached files/images
            details.attachments = new List<AttachmentWrapper>();
            List<ContentDocumentLink> cdLinks = [SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.FileExtension,
                                                    ContentDocument.ContentSize, ContentDocument.CreatedDate
                                                    FROM ContentDocumentLink WHERE LinkedEntityId = :logEntryId WITH USER_MODE];
            
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
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ApproveShiftEndLogsController', 'methodName' => 'getLogEntryDetails', 'exceptionObj' => e, 'moreDetails' => e.getMessage()});
            return null;
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
            ContentDocument doc = [SELECT Id FROM ContentDocument WHERE Id = :contentDocumentId WITH USER_MODE LIMIT 1];
            delete doc;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ApproveShiftEndLogsController', 'methodName' => 'deleteContentDocument', 'exceptionObj' => e, 'moreDetails' => e.getMessage()});
        }
    }
    
    /**
     * @description: Process log entry approval with all updates
     * Uses IDs from JSON to update records directly (no queries needed)
     * Clock In/Out updated on BOTH timesheet entry and item
     * Only updates log entry status (no clearing of Approval_Data__c)
     * @param logEntryId: ID of the log entry
     * @param approvalData: JSON string containing all approval decisions and field updates with IDs
     * @param logEntryStatus: Final status for the log entry
     * @param logEntryUpdates: JSON string containing log entry field updates
     */
    @AuraEnabled
    public static void processLogEntryApproval(Id logEntryId, String approvalData, String logEntryStatus, String logEntryUpdates) {
        try {
            // Parse approval data
            Map<String, Object> approvalMap = (Map<String, Object>) JSON.deserializeUntyped(approvalData);
            Map<String, Object> logEntryUpdatesMap = (Map<String, Object>) JSON.deserializeUntyped(logEntryUpdates);

            // Process timesheets
            if (approvalMap.containsKey('timesheets')) {
                List<Object> timesheets = (List<Object>) approvalMap.get('timesheets');
                processTimesheetApprovals(timesheets, logEntryStatus);
            }
            
            // Process location processes (skip on rejection as no status field exists on Location_Process__c)
            if (approvalMap.containsKey('locationProcesses') && logEntryStatus != 'Rejected') {
                List<Object> locationProcesses = (List<Object>) approvalMap.get('locationProcesses');
                processLocationProcessApprovals(locationProcesses);
            }
            
            // Delete removed attachments (skip on rejection to preserve original data)
            if (approvalMap.containsKey('removedAttachments') && logEntryStatus != 'Rejected') {
                List<Object> removedAttachments = (List<Object>) approvalMap.get('removedAttachments');
                deleteAttachments(removedAttachments);
            }
            
            // Update log entry (status only, no clearing of Approval_Data__c)
            updateLogEntry(logEntryId, logEntryStatus, logEntryUpdatesMap);
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ApproveShiftEndLogsController', 'methodName' => 'processLogEntryApproval', 'exceptionObj' => e, 'moreDetails' => e.getMessage() + ' | Stack: ' + e.getStackTraceString()});
        }
    }
    
    /**
     * @description: Process timesheet approvals and rejections
     * This method handles:
     * 1. On Rejection: ONLY updates Status__c in BOTH Timesheet_Entry__c (parent) and Timesheet_Entry_Item__c (child)
     * 2. On Approval: Updates Clock_In_Time__c and Clock_Out_Time__c in BOTH Timesheet_Entry__c (parent) and Timesheet_Entry_Item__c (child)
     * 3. Updates Status__c in BOTH Timesheet_Entry__c and Timesheet_Entry_Item__c (Approved/Rejected/Pending)
     * 4. NO clearing of Approval_Data__c
     * 5. Each timesheet entry has exactly ONE child timesheet entry item
     * @param timesheets: List of timesheet approval data with IDs and field updates
     * @param logEntryStatus: Final status for the log entry (Approved/Rejected/Pending)
     */
    private static void processTimesheetApprovals(List<Object> timesheets, String logEntryStatus) {
        List<wfrecon__Timesheet_Entry__c> timesheetsToUpdate = new List<wfrecon__Timesheet_Entry__c>();
        List<wfrecon__Timesheet_Entry_Item__c> itemsToUpdate = new List<wfrecon__Timesheet_Entry_Item__c>();
        
        // Check if this is a rejection - on rejection, only update status, no field updates
        Boolean isRejection = (logEntryStatus == 'Rejected');
        
        // Collect all timesheet IDs to fetch their child items in one query
        Set<Id> timesheetIds = new Set<Id>();
        for (Object tsObj : timesheets) {
            Map<String, Object> tsData = (Map<String, Object>) tsObj;
            timesheetIds.add((Id) tsData.get('id'));
        }
        
        // Fetch all timesheet entry items (each timesheet entry has exactly one child)
        Map<Id, wfrecon__Timesheet_Entry_Item__c> timesheetItemMap = new Map<Id, wfrecon__Timesheet_Entry_Item__c>();
        for (wfrecon__Timesheet_Entry_Item__c item : [SELECT Id, wfrecon__Timesheet_Entry__c FROM wfrecon__Timesheet_Entry_Item__c WHERE wfrecon__Timesheet_Entry__c IN :timesheetIds WITH USER_MODE]) {
            timesheetItemMap.put(item.wfrecon__Timesheet_Entry__c, item);
        }
        
        // Process each timesheet entry and its child item
        for (Object tsObj : timesheets) {
            Map<String, Object> tsData = (Map<String, Object>) tsObj;
            Id timesheetId = (Id) tsData.get('id');
            String timesheetStatus = (String) tsData.get('status'); // Individual timesheet status
            Map<String, Object> fieldUpdates = (Map<String, Object>) tsData.get('fieldUpdates');
            
            // Determine if this individual timesheet is rejected
            Boolean isTimesheetRejected = (timesheetStatus == 'rejected' || timesheetStatus == 'Rejected');
            
            // Update timesheet entry (parent)
            wfrecon__Timesheet_Entry__c ts = new wfrecon__Timesheet_Entry__c(Id = timesheetId);
            // Use individual timesheet status if available, otherwise fallback to log entry status
            ts.wfrecon__Status__c = String.isNotBlank(timesheetStatus) ? capitalizeStatus(timesheetStatus) : logEntryStatus;
            
            // Apply field updates to parent ONLY if this specific timesheet is NOT rejected
            if (!isTimesheetRejected && fieldUpdates != null && !fieldUpdates.isEmpty()) {
                if (fieldUpdates.containsKey('wfrecon__Clock_In_Time__c')) {
                    String clockInStr = (String) fieldUpdates.get('wfrecon__Clock_In_Time__c');
                    ts.wfrecon__Clock_In_Time__c = convertUtc(clockInStr);
                }
                if (fieldUpdates.containsKey('wfrecon__Clock_Out_Time__c')) {
                    String clockOutStr = (String) fieldUpdates.get('wfrecon__Clock_Out_Time__c');
                    ts.wfrecon__Clock_Out_Time__c = convertUtc(clockOutStr);
                }
            }
            
            timesheetsToUpdate.add(ts);
            
            // Update timesheet entry item (child) - each parent has exactly ONE child
            if (timesheetItemMap.containsKey(timesheetId)) {
                wfrecon__Timesheet_Entry_Item__c item = new wfrecon__Timesheet_Entry_Item__c(
                    Id = timesheetItemMap.get(timesheetId).Id
                );
                // Use individual timesheet status if available, otherwise fallback to log entry status
                item.wfrecon__Status__c = String.isNotBlank(timesheetStatus) ? capitalizeStatus(timesheetStatus) : logEntryStatus;
                
                // Apply field updates to child ONLY if this specific timesheet is NOT rejected
                if (!isTimesheetRejected && fieldUpdates != null && !fieldUpdates.isEmpty()) {
                    if (fieldUpdates.containsKey('wfrecon__Clock_In_Time__c')) {
                        String clockInStr = (String) fieldUpdates.get('wfrecon__Clock_In_Time__c');
                        item.wfrecon__Clock_In_Time__c = convertUtc(clockInStr);
                    }
                    if (fieldUpdates.containsKey('wfrecon__Clock_Out_Time__c')) {
                        String clockOutStr = (String) fieldUpdates.get('wfrecon__Clock_Out_Time__c');
                        item.wfrecon__Clock_Out_Time__c = convertUtc(clockOutStr);
                    }
                }
                
                itemsToUpdate.add(item);
            }
        }
        
        if (!timesheetsToUpdate.isEmpty()) {
            update timesheetsToUpdate;
        }
        
        if (!itemsToUpdate.isEmpty()) {
            update itemsToUpdate;
        }
    }
    
    /**
     * @description: Convert datetime string to Datetime without timezone conversion
     * Treats input as exact time values (no timezone offset applied)
     * @param utcDateTimeStr: DateTime string in format YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD HH:mm:ss
     * @return: DateTime object with exact time values
     */
    public static Datetime convertUtc(String utcDateTimeStr) {
        try {
            if (String.isBlank(utcDateTimeStr)) return null;
    
            // Normalize string: if seconds missing, add ':00'
            if (!Pattern.matches('\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}', utcDateTimeStr)) {
                if (Pattern.matches('\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}', utcDateTimeStr)) {
                    utcDateTimeStr += ':00';
                } else if (Pattern.matches('\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}', utcDateTimeStr)) {
                    utcDateTimeStr += ':00';
                }
            }
    
            // Replace T with space for DateTime.valueOf
            utcDateTimeStr = utcDateTimeStr.replace('T', ' ');
    
            // Split date and time
            List<String> parts = utcDateTimeStr.split(' ');
            Date d = Date.valueOf(parts[0]);

            // Split time manually
            List<String> tParts = parts[1].split(':');
            Integer hh = Integer.valueOf(tParts[0]);
            Integer mm = Integer.valueOf(tParts[1]);
            Integer ss = Integer.valueOf(tParts[2]);
            Time t = Time.newInstance(hh, mm, ss, 0);

            // Create datetime WITHOUT timezone conversion
            Datetime fixedDT = Datetime.newInstance(d, t);

            return fixedDT;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ApproveShiftEndLogsController', 
                'methodName' => 'convertUtc', 
                'exceptionObj' => e, 
                'moreDetails' => 'Input: ' + utcDateTimeStr + ' | ' + e.getMessage()
            });
            return null;
        }
    }
    
    /**
     * @description: Helper method to capitalize status string (e.g., 'approved' -> 'Approved')
     * @param status: Status string in any case
     * @return: Capitalized status string
     */
    private static String capitalizeStatus(String status) {
        if (String.isBlank(status)) {
            return status;
        }
        return status.substring(0, 1).toUpperCase() + status.substring(1).toLowerCase();
    }
    
    /**
     * @description: Process location process approvals using IDs and new values directly
     * Updates Completed_Percentage__c field with new values based on individual approval status
     * Only updates if individual status is 'approved', skips if 'rejected' or 'pending'
     * NO clearing of Approval_Data__c on log entry
     * Note: This method is not called on rejection (checked before calling)
     * @param locationProcesses: List of location process approval data with IDs and new values
     */
    private static void processLocationProcessApprovals(List<Object> locationProcesses) {
        List<wfrecon__Location_Process__c> lpsToUpdate = new List<wfrecon__Location_Process__c>();
        
        for (Object lpObj : locationProcesses) {
            Map<String, Object> lpData = (Map<String, Object>) lpObj;
            Id locationProcessId = (Id) lpData.get('id');
            String status = (String) lpData.get('status');
            Integer newValue = lpData.get('newValue') != null ? (Integer) lpData.get('newValue') : null;
            
            // Only update if this specific location process is approved
            Boolean isApproved = (status == 'approved' || status == 'Approved');
            
            if (isApproved && newValue != null) {
                // Update location process with new value (user can edit the new value)
                wfrecon__Location_Process__c lp = new wfrecon__Location_Process__c(Id = locationProcessId);
                lp.wfrecon__Completed_Percentage__c = newValue;
                lpsToUpdate.add(lp);
            }
        }
        
        if (!lpsToUpdate.isEmpty()) {
            update lpsToUpdate;
        }
    }
    
    /**
     * @description: Delete removed attachments
     * @param removedAttachments: List of content document IDs to delete
     */
    private static void deleteAttachments(List<Object> removedAttachments) {
        if (removedAttachments == null || removedAttachments.isEmpty()) {
            return;
        }
        
        Set<Id> docIds = new Set<Id>();
        for (Object attachmentId : removedAttachments) {
            docIds.add((Id) attachmentId);
        }
        
        List<ContentDocument> docsToDelete = [SELECT Id FROM ContentDocument WHERE Id IN :docIds WITH USER_MODE];
        if (!docsToDelete.isEmpty()) {
            delete docsToDelete;
        }
    }
    
    /**
     * @description: Update log entry with final status and field updates
     * On Rejection: ONLY updates Status__c field
     * On Approval: Updates Status__c and other fields (workPerformed, planForTomorrow, exceptions, notesToOffice)
     * @param logEntryId: ID of the log entry
     * @param status: Final status for the log entry (Approved/Rejected/Pending)
     * @param fieldUpdates: Map of field updates
     */
    private static void updateLogEntry(Id logEntryId, String status, Map<String, Object> fieldUpdates) {
        wfrecon__Log_Entry__c logEntry = new wfrecon__Log_Entry__c(Id = logEntryId);

        logEntry.wfrecon__Status__c = status;
        logEntry.wfrecon__Approved_Date__c = Datetime.now();
        logEntry.wfrecon__Approved_By__c = UserInfo.getUserId();
        
        if (fieldUpdates.containsKey('workPerformed')) {
            logEntry.wfrecon__Work_Performed__c = (String) fieldUpdates.get('workPerformed');
        }
        if (fieldUpdates.containsKey('planForTomorrow')) {
            logEntry.wfrecon__Plan_for_Tomorrow__c = (String) fieldUpdates.get('planForTomorrow');
        }
        if (fieldUpdates.containsKey('exceptions')) {
            logEntry.wfrecon__Exceptions__c = (String) fieldUpdates.get('exceptions');
        }
        if (fieldUpdates.containsKey('notesToOffice')) {
            logEntry.wfrecon__Notes_to_Office__c = (String) fieldUpdates.get('notesToOffice');
        }
        
        update logEntry;
    }
    
    /**
     * @description: Save camera photo as ContentVersion and link to the EXISTING Log Entry
     * @param parentId: The Log Entry ID
     * @param fileName: Name of the file
     * @param base64Data: Image data
     */
    @AuraEnabled
    public static String saveCameraPhoto(Id parentId, String fileName, String base64Data) {
        try {
            ContentVersion cv = new ContentVersion();
            cv.Title = fileName;
            cv.PathOnClient = fileName;
            cv.VersionData = EncodingUtil.base64Decode(base64Data);
            cv.FirstPublishLocationId = parentId; // Automatically links to the record
            insert as user cv;
            
            return [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id].ContentDocumentId;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ApproveShiftEndLogsController', 'methodName' => 'saveCameraPhoto', 'exceptionObj' => e});
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description: Link existing Chatter files to the EXISTING Log Entry
     * @param parentId: The Log Entry ID
     * @param contentDocumentIds: List of file IDs to link
     */
    @AuraEnabled
    public static void linkChatterFiles(Id parentId, List<String> contentDocumentIds) {
        try {
            List<ContentDocumentLink> links = new List<ContentDocumentLink>();
            for(String docId : contentDocumentIds) {
                ContentDocumentLink link = new ContentDocumentLink();
                link.ContentDocumentId = docId;
                link.LinkedEntityId = parentId;
                link.ShareType = 'V';
                link.Visibility = 'AllUsers';
                links.add(link);
            }
            insert as user links;
        } catch (Exception e) {
            // Ignore duplicate errors if file is already linked
            if(!e.getMessage().contains('DUPLICATE_VALUE')) {
                ExceptionHandler.logException(new Map<String, Object>{'className' => 'ApproveShiftEndLogsController', 'methodName' => 'linkChatterFiles', 'exceptionObj' => e});
                throw new AuraHandledException(e.getMessage());
            }
        }
    }
    
    /**
     * @description: Wrapper class for Log Entry Response
     */
    public class LogEntryResponse {
        @AuraEnabled public List<LogEntryWrapper> entries { get; set; }
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
        @AuraEnabled public Id jobId { get; set; }
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
        @AuraEnabled public String locationId { get; set; }
        @AuraEnabled public String locationName { get; set; }
        @AuraEnabled public Integer sequence { get; set; }
        @AuraEnabled public Integer currentValue { get; set; }
        @AuraEnabled public Integer oldValue { get; set; }
        @AuraEnabled public Integer newValue { get; set; }
        @AuraEnabled public Boolean hasChanges { get; set; }
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