public with sharing class ShiftEndLogV2Controller {

    public static final String CLASSNAME = 'ShiftEndLogV2Controller';

    @AuraEnabled
    public static ShiftEndLogWithCrewWrapper getShiftEndLogsWithCrewInfo(Id jobId) {
        ShiftEndLogWithCrewWrapper resultWrapper = new ShiftEndLogWithCrewWrapper();

        try {
            // -----------------------------
            // Step 1: Get Current User's Crew Info
            // -----------------------------
            Id userId = UserInfo.getUserId();
            Contact userContact = [
                SELECT Id, wfrecon__User__c 
                FROM Contact 
                WHERE wfrecon__User__c = :userId
                WITH USER_MODE
                LIMIT 1
            ];

            System.debug('User Contact: ' + userContact);

            if(userContact != null) {
                // Get Mobilizations related to the job
                List<wfrecon__Mobilization__c> mobilizations = jobId != null 
                    ? [SELECT Id FROM wfrecon__Mobilization__c WHERE wfrecon__Job__c = :jobId WITH USER_MODE] 
                    : new List<wfrecon__Mobilization__c>();

                    System.debug('Found Mobilizations: ' + mobilizations);

                if(!mobilizations.isEmpty()) {
                    Set<Id> mobilizationIds = new Set<Id>();
                    for(wfrecon__Mobilization__c mob : mobilizations){
                        mobilizationIds.add(mob.Id);
                    }

                    System.debug('Found Mobilization IDs: ' + mobilizationIds);

                    // Get Crew IDs from Mobilization Members
                    Set<Id> crewIdsFromMobilizations = new Set<Id>();
                    for(wfrecon__Mobilization_Member__c mm : [
                        SELECT wfrecon__Crew__c 
                        FROM wfrecon__Mobilization_Member__c 
                        WHERE wfrecon__Mobilization__c IN :mobilizationIds
                        AND wfrecon__Crew__c != null
                        WITH USER_MODE
                    ]) {
                        crewIdsFromMobilizations.add(mm.wfrecon__Crew__c);
                    }

                    System.debug('Found Crew IDs from Mobilizations: ' + crewIdsFromMobilizations);

                    // Get Crews where user is leader
                    if(!crewIdsFromMobilizations.isEmpty()) {

                        // Query Crew Member records where user is marked as leader
                        List<wfrecon__Crew_Member__c> leaderCrewMembers = [
                            SELECT Id, wfrecon__Crew__c, wfrecon__Contact__c
                            FROM wfrecon__Crew_Member__c
                            WHERE wfrecon__Crew__c IN :crewIdsFromMobilizations
                            AND wfrecon__Contact__c = :userContact.Id
                            AND wfrecon__Member_Type__c = 'Leader'
                            WITH USER_MODE
                        ];

                        if (!leaderCrewMembers.isEmpty()) {
                            resultWrapper.crewInfo.crewLeaderId = String.valueOf(userContact.Id);

                            for (wfrecon__Crew_Member__c member : leaderCrewMembers) {
                                resultWrapper.crewInfo.crewIds.add(String.valueOf(member.wfrecon__Crew__c));
                            }

                            System.debug('Set Crew Leader ID: ' + resultWrapper.crewInfo.crewLeaderId);
                            System.debug('Set Crew IDs: ' + resultWrapper.crewInfo.crewIds);
                        }
                    }
                }
            }

            // -----------------------------
            // Step 2: Get Shift End Logs with Images
            // -----------------------------
            List<wfrecon__Log_Entry__c> shiftEndLogs = jobId != null
                ? [SELECT Id, Name, wfrecon__Job__c, wfrecon__Work_Performed__c, wfrecon__Work_Performed_Date__c, 
                        wfrecon__Log_Type__c, wfrecon__Exceptions__c, wfrecon__Plan_for_Tomorrow__c, wfrecon__Notes_to_Office__c,
                        wfrecon__Status__c, wfrecon__Approval_Data__c,
                        CreatedBy.Name, CreatedDate, LastModifiedDate
                   FROM wfrecon__Log_Entry__c 
                   WHERE wfrecon__Job__c = :jobId 
                   AND wfrecon__Log_Type__c = 'Shift End'
                   ORDER BY CreatedDate DESC]
                : new List<wfrecon__Log_Entry__c>();

            Set<Id> logIds = new Set<Id>();
            for(wfrecon__Log_Entry__c log : shiftEndLogs) logIds.add(log.Id);

            // Parse approval data from each log to identify pending processes
            // Now supports both old structure (array) and new structure (object with locationProcessChanges)
            Map<Id, Set<Id>> logPendingProcessesMap = new Map<Id, Set<Id>>();
            for(wfrecon__Log_Entry__c log : shiftEndLogs) {
                if(String.isNotBlank(log.wfrecon__Approval_Data__c)) {
                    try {
                        Object approvalDataObj = JSON.deserializeUntyped(log.wfrecon__Approval_Data__c);
                        Set<Id> pendingProcessIds = new Set<Id>();
                        
                        if(approvalDataObj instanceof Map<String, Object>) {
                            // New structure: { locationProcessChanges: [], timesheetEntryChanges: {} }
                            Map<String, Object> approvalData = (Map<String, Object>) approvalDataObj;
                            List<Object> locationProcessChanges = (List<Object>) approvalData.get('locationProcessChanges');
                            
                            if(locationProcessChanges != null) {
                                for(Object item : locationProcessChanges) {
                                    Map<String, Object> approvalItem = (Map<String, Object>) item;
                                    String processId = (String) approvalItem.get('id');
                                    if(String.isNotBlank(processId)) {
                                        pendingProcessIds.add(processId);
                                    }
                                }
                            }
                        } else if(approvalDataObj instanceof List<Object>) {
                            // Old structure: [{ id, oldValue, newValue }]
                            List<Object> approvalList = (List<Object>) approvalDataObj;
                            for(Object item : approvalList) {
                                Map<String, Object> approvalItem = (Map<String, Object>) item;
                                String processId = (String) approvalItem.get('id');
                                if(String.isNotBlank(processId)) {
                                    pendingProcessIds.add(processId);
                                }
                            }
                        }
                        
                        if(!pendingProcessIds.isEmpty()) {
                            logPendingProcessesMap.put(log.Id, pendingProcessIds);
                        }
                    } catch (Exception e) {
                        System.debug('Error parsing approval data: ' + e.getMessage());
                    }
                }
            }

            // Get field history for today's changes
            Map<Id, List<FieldChangeInfo>> logFieldChangesMap = new Map<Id, List<FieldChangeInfo>>();
            if(!logIds.isEmpty()) {
                Date today = Date.today();
                List<wfrecon__Log_Entry__History> historyRecords = [
                    SELECT ParentId, Field, OldValue, NewValue, CreatedDate, CreatedBy.Name
                    FROM wfrecon__Log_Entry__History
                    WHERE ParentId IN :logIds
                    AND CreatedDate = TODAY
                    WITH USER_MODE
                    ORDER BY CreatedDate DESC
                ];

                for(wfrecon__Log_Entry__History hist : historyRecords) {
                    if(!logFieldChangesMap.containsKey(hist.ParentId)) {
                        logFieldChangesMap.put(hist.ParentId, new List<FieldChangeInfo>());
                    }
                    
                    FieldChangeInfo changeInfo = new FieldChangeInfo();
                    changeInfo.fieldName = hist.Field;
                    // Convert null to empty string, otherwise convert to string
                    changeInfo.oldValue = hist.OldValue != null ? String.valueOf(hist.OldValue) : '(blank)';
                    changeInfo.newValue = hist.NewValue != null ? String.valueOf(hist.NewValue) : '(blank)';
                    changeInfo.changedBy = hist.CreatedBy?.Name;
                    changeInfo.changedDate = hist.CreatedDate;
                    
                    logFieldChangesMap.get(hist.ParentId).add(changeInfo);
                }
            }

            // Get current location processes for the job
            Map<Id, List<LocationProcessSnapshot>> jobLocationProcessesMap = new Map<Id, List<LocationProcessSnapshot>>();
            if(jobId != null) {
                List<wfrecon__Location_Process__c> locationProcesses = [
                    SELECT Id, Name, wfrecon__Completed_Percentage__c, wfrecon__Sequence__c,
                           wfrecon__Location__c, wfrecon__Location__r.Name
                    FROM wfrecon__Location_Process__c 
                    WHERE wfrecon__Location__r.wfrecon__Job__c = :jobId 
                    WITH USER_MODE
                    ORDER BY wfrecon__Location__r.Name ASC, wfrecon__Sequence__c ASC NULLS LAST, CreatedDate ASC
                ];

                // Get location process IDs for history tracking
                Set<Id> locationProcessIds = new Set<Id>();
                for(wfrecon__Location_Process__c lp : locationProcesses) {
                    locationProcessIds.add(lp.Id);
                }

                // Get completion percentage changes for today
                // Exclude processes that are approved/auto-approved (they count as completed, not "changed today")
                Map<Id, wfrecon__Location_Process__History> processChangesMap = new Map<Id, wfrecon__Location_Process__History>();
                Set<Id> approvedProcessIds = new Set<Id>();
                
                // Collect all approved process IDs from all logs
                for(wfrecon__Log_Entry__c log : shiftEndLogs) {
                    if(log.wfrecon__Status__c == 'Approved' || log.wfrecon__Status__c == 'Auto-Approved') {
                        if(logPendingProcessesMap.containsKey(log.Id)) {
                            approvedProcessIds.addAll(logPendingProcessesMap.get(log.Id));
                        }
                    }
                }
                
                if(!locationProcessIds.isEmpty()) {
                    List<wfrecon__Location_Process__History> processHistoryRecords = [
                        SELECT ParentId, Field, OldValue, NewValue, CreatedDate, CreatedBy.Name
                        FROM wfrecon__Location_Process__History
                        WHERE ParentId IN :locationProcessIds
                        AND Field = 'wfrecon__Completed_Percentage__c'
                        AND CreatedDate = TODAY
                        WITH USER_MODE
                        ORDER BY CreatedDate DESC
                    ];

                    for(wfrecon__Location_Process__History hist : processHistoryRecords) {
                        // Only mark as "changed today" if not approved
                        if(!processChangesMap.containsKey(hist.ParentId) && !approvedProcessIds.contains(hist.ParentId)) {
                            processChangesMap.put(hist.ParentId, hist);
                        }
                    }
                }

                List<LocationProcessSnapshot> processSnapshots = new List<LocationProcessSnapshot>();
                for(wfrecon__Location_Process__c lp : locationProcesses) {
                    LocationProcessSnapshot snapshot = new LocationProcessSnapshot();
                    snapshot.processId = lp.Id;
                    snapshot.processName = lp.Name;
                    snapshot.locationName = lp.wfrecon__Location__r.Name;
                    snapshot.completionPercentage = lp.wfrecon__Completed_Percentage__c != null 
                        ? lp.wfrecon__Completed_Percentage__c 
                        : 0;
                    snapshot.sequence = lp.wfrecon__Sequence__c != null 
                        ? Integer.valueOf(lp.wfrecon__Sequence__c) 
                        : null;
                    
                    // Check if this process is approved (counts as completed)
                    Boolean isApproved = approvedProcessIds.contains(lp.Id);
                    
                    // Add change tracking information
                    if(processChangesMap.containsKey(lp.Id)) {
                        wfrecon__Location_Process__History histRecord = processChangesMap.get(lp.Id);
                        snapshot.changedToday = true;
                        snapshot.oldPercentage = histRecord.OldValue != null ? Decimal.valueOf(String.valueOf(histRecord.OldValue)) : 0;
                        snapshot.newPercentage = histRecord.NewValue != null ? Decimal.valueOf(String.valueOf(histRecord.NewValue)) : 0;
                        snapshot.changedBy = histRecord.CreatedBy?.Name;
                        
                        // Calculate progress bar segments
                        // yesterdayPercentage = total completed till yesterday (before today's change)
                        snapshot.yesterdayPercentage = snapshot.oldPercentage;
                        // todayChangePercentage = how much was added/changed today
                        snapshot.todayChangePercentage = snapshot.newPercentage - snapshot.oldPercentage;
                        
                        // Set colors: Green for completed, Purple for today's change
                        snapshot.progressBarColor = '#28a745'; // Green for completed progress
                        snapshot.todayChangeColor = 'rgba(94, 90, 219, 1)'; // Purple for today's change
                    } else if(isApproved) {
                        // Approved processes show as completed (all green), no "changed today" badge
                        snapshot.changedToday = false;
                        snapshot.oldPercentage = null;
                        snapshot.newPercentage = null;
                        snapshot.changedBy = null;
                        snapshot.yesterdayPercentage = snapshot.completionPercentage;
                        snapshot.todayChangePercentage = 0;
                        snapshot.progressBarColor = '#28a745'; // All green for approved/completed
                        snapshot.todayChangeColor = null;
                    } else {
                        snapshot.changedToday = false;
                        snapshot.oldPercentage = null;
                        snapshot.newPercentage = null;
                        snapshot.changedBy = null;
                        
                        // No change today - all progress is from before
                        // yesterdayPercentage = all completed work (no change today)
                        snapshot.yesterdayPercentage = snapshot.completionPercentage;
                        snapshot.todayChangePercentage = 0;
                        snapshot.progressBarColor = '#28a745'; // Green for all completed progress
                        snapshot.todayChangeColor = null;
                    }
                    
                    processSnapshots.add(snapshot);
                }
                
                // Store location processes for this job
                if(!processSnapshots.isEmpty()) {
                    jobLocationProcessesMap.put(jobId, processSnapshots);
                }
            }

            Map<Id, List<ContentVersion>> logImagesMap = new Map<Id, List<ContentVersion>>();
            if(!logIds.isEmpty()) {
                List<ContentDocumentLink> contentLinks = [
                    SELECT Id, LinkedEntityId, ContentDocumentId, ContentDocument.LatestPublishedVersionId
                    FROM ContentDocumentLink 
                    WHERE LinkedEntityId IN :logIds
                    WITH USER_MODE
                ];

                Set<Id> versionIds = new Set<Id>();
                Map<Id, Id> versionToLogMap = new Map<Id, Id>();
                for(ContentDocumentLink cdl : contentLinks) {
                    versionIds.add(cdl.ContentDocument.LatestPublishedVersionId);
                    versionToLogMap.put(cdl.ContentDocument.LatestPublishedVersionId, cdl.LinkedEntityId);
                }

                if(!versionIds.isEmpty()) {
                    List<ContentVersion> versions = [
                        SELECT Id, ContentDocumentId, Title, FileExtension, ContentSize, CreatedDate
                        FROM ContentVersion 
                        WHERE Id IN :versionIds 
                        // AND FileExtension IN ('jpg','jpeg','png','gif','bmp','svg')
                        WITH USER_MODE
                        ORDER BY CreatedDate DESC
                    ];

                    for(ContentVersion cv : versions) {
                        Id logId = versionToLogMap.get(cv.Id);
                        if(!logImagesMap.containsKey(logId)) logImagesMap.put(logId, new List<ContentVersion>());
                        logImagesMap.get(logId).add(cv);
                    }
                }
            }

            for(wfrecon__Log_Entry__c log : shiftEndLogs) {
                ShiftEndLogWrapper wrapper = new ShiftEndLogWrapper();
                wrapper.logEntry = log;
                wrapper.images = logImagesMap.containsKey(log.Id) ? logImagesMap.get(log.Id) : new List<ContentVersion>();
                
                // Get current location processes for this job
                wrapper.locationProcesses = jobLocationProcessesMap.containsKey(log.wfrecon__Job__c) 
                    ? jobLocationProcessesMap.get(log.wfrecon__Job__c) 
                    : new List<LocationProcessSnapshot>();
                
                // Get field changes for today
                wrapper.fieldChanges = logFieldChangesMap.containsKey(log.Id) 
                    ? logFieldChangesMap.get(log.Id) 
                    : new List<FieldChangeInfo>();
                
                resultWrapper.shiftEndLogs.add(wrapper);
            }

        } catch(Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getShiftEndLogsWithCrewInfo',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error retrieving shift end logs and crew info for jobId: ' + jobId,
                'apiResponse' => null
            });
        }

        return resultWrapper;
    }

    @AuraEnabled
    public static void updateShiftEndLogWithImages(wfrecon__Log_Entry__c logEntry, List<String> contentDocumentIdsToDelete, List<String> contentDocumentIdsToUnlink, String cameraPhotosJson) {
        try {
            if(logEntry == null) {
                throw new AuraHandledException('Invalid log entry');
            }

            // Step 1: Unlink Chatter images (don't delete, just remove the link)
            if (contentDocumentIdsToUnlink != null && !contentDocumentIdsToUnlink.isEmpty()) {
                List<ContentDocumentLink> linksToDelete = [
                    SELECT Id 
                    FROM ContentDocumentLink 
                    WHERE ContentDocumentId IN :contentDocumentIdsToUnlink
                    AND LinkedEntityId = :logEntry.Id
                    WITH USER_MODE
                ];
                
                if (!linksToDelete.isEmpty()) {
                    delete as user linksToDelete;
                }
            }

            // Step 2: Delete newly uploaded files if any
            if (contentDocumentIdsToDelete != null && !contentDocumentIdsToDelete.isEmpty()) {
                List<ContentDocument> docsToDelete = [
                    SELECT Id 
                    FROM ContentDocument 
                    WHERE Id IN :contentDocumentIdsToDelete 
                    WITH USER_MODE
                ];
                
                if (!docsToDelete.isEmpty()) {
                    delete as user docsToDelete;
                }
            }

            // Step 3: Update the log entry (including wfrecon__Approval_Data__c if provided)
            update as user logEntry;

            // Step 4: Process camera photos if any
            if (String.isNotBlank(cameraPhotosJson)) {
                List<Object> cameraPhotos = (List<Object>) JSON.deserializeUntyped(cameraPhotosJson);
                List<ContentVersion> contentVersions = new List<ContentVersion>();
                
                for (Object photoObj : cameraPhotos) {
                    Map<String, Object> photo = (Map<String, Object>) photoObj;
                    String fileName = (String) photo.get('fileName');
                    String base64Data = (String) photo.get('base64Data');
                    
                    ContentVersion cv = new ContentVersion();
                    cv.Title = fileName;
                    cv.PathOnClient = fileName;
                    cv.VersionData = EncodingUtil.base64Decode(base64Data);
                    cv.FirstPublishLocationId = logEntry.Id; // This automatically creates the link
                    contentVersions.add(cv);
                }
                
                if (!contentVersions.isEmpty()) {
                    insert as user contentVersions;
                }
            }

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME, 
                'methodName' => 'updateShiftEndLogWithImages', 
                'isApiException' => false, 
                'statusCode' => null, 
                'exceptionObj' => e,
                'moreDetails' => 'Error updating Shift End Log with Id: ' + logEntry?.Id,
                'apiResponse' => null
            });
            throw new AuraHandledException('Error updating shift end log: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static String deleteShiftEndLog(Id logId) {
        try {
            if(logId == null) {
                throw new AuraHandledException('Invalid log entry ID');
            }

            wfrecon__Log_Entry__c logToDelete = new wfrecon__Log_Entry__c(Id = logId);

            delete as user logToDelete;
            
            return 'Success: Shift end log deleted successfully';

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME, 
                'methodName' => 'deleteShiftEndLog', 
                'isApiException' => false, 
                'statusCode' => null, 
                'exceptionObj' => e,
                'moreDetails' => 'Error deleting Shift End Log with Id: ' + logId,
                'apiResponse' => null
            });
            throw new AuraHandledException('Error deleting shift end log: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteUploadedFiles(List<String> contentDocumentIds) {
        try {
            if (contentDocumentIds == null || contentDocumentIds.isEmpty()) {
                return;
            }

            List<ContentDocument> docsToDelete = [
                SELECT Id 
                FROM ContentDocument 
                WHERE Id IN :contentDocumentIds 
                WITH USER_MODE
            ];
            
            if (!docsToDelete.isEmpty()) {
                delete as user docsToDelete;
            }

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME, 
                'methodName' => 'deleteUploadedFiles', 
                'isApiException' => false, 
                'statusCode' => null, 
                'exceptionObj' => e,
                'moreDetails' => 'Error deleting uploaded files: ' + contentDocumentIds,
                'apiResponse' => null
            });
            throw new AuraHandledException('Error deleting uploaded files: ' + e.getMessage());
        }
    }

    // -----------------------------
    // Wrapper classes
    // -----------------------------
    public class ShiftEndLogWithCrewWrapper {
        @AuraEnabled public CrewInfoWrapper crewInfo { get; set; }
        @AuraEnabled public List<ShiftEndLogWrapper> shiftEndLogs { get; set; }

        public ShiftEndLogWithCrewWrapper() {
            crewInfo = new CrewInfoWrapper();
            shiftEndLogs = new List<ShiftEndLogWrapper>();
        }
    }

    public class CrewInfoWrapper {
        @AuraEnabled public String crewLeaderId { get; set; }
        @AuraEnabled public List<String> crewIds { get; set; }

        public CrewInfoWrapper() {
            crewLeaderId = null;
            crewIds = new List<String>();
        }
    }

    public class ShiftEndLogWrapper {
        @AuraEnabled public wfrecon__Log_Entry__c logEntry { get; set; }
        @AuraEnabled public List<ContentVersion> images { get; set; }
        @AuraEnabled public List<LocationProcessSnapshot> locationProcesses { get; set; }
        @AuraEnabled public List<FieldChangeInfo> fieldChanges { get; set; }
    }

    public class LocationProcessSnapshot {
        @AuraEnabled public String processId { get; set; }
        @AuraEnabled public String processName { get; set; }
        @AuraEnabled public String locationName { get; set; }
        @AuraEnabled public Decimal completionPercentage { get; set; }
        @AuraEnabled public Integer sequence { get; set; }
        @AuraEnabled public Boolean changedToday { get; set; }
        @AuraEnabled public Decimal oldPercentage { get; set; }
        @AuraEnabled public Decimal newPercentage { get; set; }
        @AuraEnabled public String changedBy { get; set; }
        
        // Progress bar segments for visual display
        @AuraEnabled public Decimal yesterdayPercentage { get; set; }  // Percentage completed till yesterday
        @AuraEnabled public Decimal todayChangePercentage { get; set; } // Additional % completed today
        @AuraEnabled public String progressBarColor { get; set; }       // Base color for progress
        @AuraEnabled public String todayChangeColor { get; set; }       // Color for today's change
    }

    public class FieldChangeInfo {
        @AuraEnabled public String fieldName { get; set; }
        @AuraEnabled public String oldValue { get; set; }
        @AuraEnabled public String newValue { get; set; }
        @AuraEnabled public String changedBy { get; set; }
        @AuraEnabled public DateTime changedDate { get; set; }
    }

}