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

            // Field changes are now tracked in approval data, no need for history tracking

            // Get current location processes for the job - changes are tracked in approval data
            Map<Id, List<LocationProcessSnapshot>> jobLocationProcessesMap = new Map<Id, List<LocationProcessSnapshot>>();
            if(jobId != null) {
                List<wfrecon__Location_Process__c> locationProcesses = [
                    SELECT Id, Name, wfrecon__Completed_Percentage__c, wfrecon__Sequence__c, wfrecon__Process_Name__c,
                           wfrecon__Location__c, wfrecon__Location__r.Name
                    FROM wfrecon__Location_Process__c 
                    WHERE wfrecon__Location__r.wfrecon__Job__c = :jobId 
                    WITH USER_MODE
                    ORDER BY wfrecon__Location__r.Name ASC, wfrecon__Sequence__c ASC NULLS LAST, CreatedDate ASC
                ];

                List<LocationProcessSnapshot> processSnapshots = new List<LocationProcessSnapshot>();
                for(wfrecon__Location_Process__c lp : locationProcesses) {
                    LocationProcessSnapshot snapshot = new LocationProcessSnapshot();
                    snapshot.processId = lp.Id;
                    snapshot.processName = lp.wfrecon__Process_Name__c != null ? lp.wfrecon__Process_Name__c : lp.Name;
                    snapshot.locationName = lp.wfrecon__Location__r.Name;
                    snapshot.completionPercentage = lp.wfrecon__Completed_Percentage__c != null 
                        ? lp.wfrecon__Completed_Percentage__c 
                        : 0;
                    snapshot.sequence = lp.wfrecon__Sequence__c != null 
                        ? Integer.valueOf(lp.wfrecon__Sequence__c) 
                        : null;
                    
                    // Changes are tracked in approval data, not history
                    // JavaScript will parse approval data for each log
                    snapshot.changedToday = false;
                    snapshot.oldPercentage = null;
                    snapshot.newPercentage = null;
                    snapshot.changedBy = null;
                    snapshot.yesterdayPercentage = snapshot.completionPercentage;
                    snapshot.todayChangePercentage = 0;
                    snapshot.progressBarColor = '#28a745';
                    snapshot.todayChangeColor = null;
                    
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
                Map<Id, List<Id>> versionToLogListMap = new Map<Id, List<Id>>();
                for(ContentDocumentLink cdl : contentLinks) {
                    versionIds.add(cdl.ContentDocument.LatestPublishedVersionId);
                    
                    // Support multiple log entries linked to the same version
                    if(!versionToLogListMap.containsKey(cdl.ContentDocument.LatestPublishedVersionId)) {
                        versionToLogListMap.put(cdl.ContentDocument.LatestPublishedVersionId, new List<Id>());
                    }
                    versionToLogListMap.get(cdl.ContentDocument.LatestPublishedVersionId).add(cdl.LinkedEntityId);
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
                        List<Id> linkedLogIds = versionToLogListMap.get(cv.Id);
                        if(linkedLogIds != null) {
                            for(Id logId : linkedLogIds) {
                                if(!logImagesMap.containsKey(logId)) {
                                    logImagesMap.put(logId, new List<ContentVersion>());
                                }
                                logImagesMap.get(logId).add(cv);
                            }
                        }
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
                
                // Field changes and location process changes are now in approval data (wfrecon__Approval_Data__c)
                // JavaScript will parse approval data to display changes
                
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
    public static void updateShiftEndLogWithImages(wfrecon__Log_Entry__c logEntry, List<String> contentDocumentIdsToDelete, List<String> contentDocumentIdsToUnlink, List<String> contentDocumentIdsToLink, String cameraPhotosJson) {
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

            // Step 2: Delete uploaded/captured files if any
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
            
            // Step 2.5: Link new uploaded files and Chatter files to log entry
            if (contentDocumentIdsToLink != null && !contentDocumentIdsToLink.isEmpty()) {
                // Check for existing links to avoid "entity is already linked" error
                Set<Id> existingLinkedDocIds = new Set<Id>();
                for (ContentDocumentLink existingLink : [
                    SELECT ContentDocumentId
                    FROM ContentDocumentLink
                    WHERE LinkedEntityId = :logEntry.Id
                    AND ContentDocumentId IN :contentDocumentIdsToLink
                    WITH USER_MODE
                ]) {
                    existingLinkedDocIds.add(existingLink.ContentDocumentId);
                }
                
                List<ContentDocumentLink> newLinks = new List<ContentDocumentLink>();
                
                for (String docId : contentDocumentIdsToLink) {
                    // Only create link if not already linked
                    if (!existingLinkedDocIds.contains(docId)) {
                        ContentDocumentLink link = new ContentDocumentLink();
                        link.ContentDocumentId = docId;
                        link.LinkedEntityId = logEntry.Id;
                        link.ShareType = 'V';
                        link.Visibility = 'AllUsers';
                        newLinks.add(link);
                    }
                }
                
                if (!newLinks.isEmpty()) {
                    insert as user newLinks;
                }
            }

            // Step 3: Process camera photos if any
            List<String> cameraPhotoDocIds = new List<String>();
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
                    
                    // Get the ContentDocument IDs for the camera photos we just inserted
                    Set<Id> versionIds = new Set<Id>();
                    for (ContentVersion cv : contentVersions) {
                        versionIds.add(cv.Id);
                    }
                    
                    List<ContentVersion> insertedVersions = [
                        SELECT Id, ContentDocumentId, Title
                        FROM ContentVersion
                        WHERE Id IN :versionIds
                        WITH USER_MODE
                    ];
                    
                    // Add camera photos to metadata in approval data
                    if (String.isNotBlank(logEntry.wfrecon__Approval_Data__c)) {
                        Map<String, Object> approvalData = (Map<String, Object>) JSON.deserializeUntyped(logEntry.wfrecon__Approval_Data__c);
                        List<Object> mediaMetadata = (List<Object>) approvalData.get('mediaMetadata');
                        
                        if (mediaMetadata == null) {
                            mediaMetadata = new List<Object>();
                        }
                        
                        // Add camera photos to metadata
                        for (ContentVersion cv : insertedVersions) {
                            Map<String, Object> metadata = new Map<String, Object>();
                            metadata.put('contentDocumentId', cv.ContentDocumentId);
                            metadata.put('source', 'camera');
                            metadata.put('name', cv.Title);
                            mediaMetadata.add(metadata);
                        }
                        
                        approvalData.put('mediaMetadata', mediaMetadata);
                        logEntry.wfrecon__Approval_Data__c = JSON.serialize(approvalData);
                    }
                }
            }
            
            // Step 4: Update the log entry with approval data (includes camera metadata if added)
            // Only update the fields that are explicitly set, including wfrecon__Approval_Data__c if provided
            // The logEntry passed from JavaScript contains only the fields to update
            update logEntry;

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

            // Get the log entry to access approval data
            wfrecon__Log_Entry__c logEntry = [
                SELECT Id, wfrecon__Approval_Data__c
                FROM wfrecon__Log_Entry__c
                WHERE Id = :logId
                WITH USER_MODE
                LIMIT 1
            ];
            
            // Parse media metadata to identify Chatter files
            Set<String> chatterFileIds = new Set<String>();
            if (String.isNotBlank(logEntry.wfrecon__Approval_Data__c)) {
                try {
                    Map<String, Object> approvalData = (Map<String, Object>) JSON.deserializeUntyped(logEntry.wfrecon__Approval_Data__c);
                    List<Object> mediaMetadata = (List<Object>) approvalData.get('mediaMetadata');
                    
                    if (mediaMetadata != null) {
                        for (Object metaObj : mediaMetadata) {
                            Map<String, Object> meta = (Map<String, Object>) metaObj;
                            String source = (String) meta.get('source');
                            String contentDocId = (String) meta.get('contentDocumentId');
                            
                            // Track Chatter files to avoid deleting them
                            if (source == 'chatter' && contentDocId != null) {
                                chatterFileIds.add(contentDocId);
                            }
                        }
                    }
                } catch (Exception e) {
                    System.debug('Error parsing approval data for media cleanup: ' + e.getMessage());
                }
            }
            
            // Get all linked content documents
            List<ContentDocumentLink> allLinks = [
                SELECT ContentDocumentId
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :logId
                WITH USER_MODE
            ];
            
            Set<String> contentDocIdsToDelete = new Set<String>();
            for (ContentDocumentLink link : allLinks) {
                // Only delete if NOT a Chatter file
                if (!chatterFileIds.contains(link.ContentDocumentId)) {
                    contentDocIdsToDelete.add(link.ContentDocumentId);
                }
            }
            
            // Delete the log entry (this will cascade delete the ContentDocumentLinks)
            delete as user logEntry;
            
            // Delete uploaded/captured content documents (excluding Chatter files)
            if (!contentDocIdsToDelete.isEmpty()) {
                List<ContentDocument> docsToDelete = [
                    SELECT Id
                    FROM ContentDocument
                    WHERE Id IN :contentDocIdsToDelete
                    WITH USER_MODE
                ];
                
                if (!docsToDelete.isEmpty()) {
                    delete as user docsToDelete;
                }
            }
            
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

    /**
     * Check if org has enough storage space for file uploads
     * @return Map with hasSpace (Boolean), percentUsed (Decimal), and message (String)
     */
    @AuraEnabled
    public static Map<String, Object> checkOrgStorageLimit() {
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            // Get org limits for file storage
            Map<String, System.OrgLimit> orgLimits = OrgLimits.getMap();
            
            // Check FileStorageMB limit
            System.OrgLimit fileStorageLimit = orgLimits.get('FileStorageMB');
            
            if (fileStorageLimit != null) {
                Integer maxFileStorage = fileStorageLimit.getLimit();
                Integer usedFileStorage = fileStorageLimit.getValue();
                Decimal percentUsed = (maxFileStorage > 0) ? ((Decimal)usedFileStorage / maxFileStorage * 100).setScale(2) : 0;
                
                Boolean hasSpace = percentUsed < 95; // Block uploads if > 95% used
                String message = '';
                
                if (percentUsed >= 95) {
                    message = 'Organization file storage is ' + percentUsed + '% full. Cannot upload more files. Please contact your administrator.';
                } else if (percentUsed >= 90) {
                    message = 'Warning: Organization file storage is ' + percentUsed + '% full. Consider removing unused files.';
                }
                
                result.put('hasSpace', hasSpace);
                result.put('percentUsed', percentUsed);
                result.put('message', message);
                result.put('usedMB', usedFileStorage);
                result.put('maxMB', maxFileStorage);
            } else {
                // If limit info not available, allow upload
                result.put('hasSpace', true);
                result.put('percentUsed', 0);
                result.put('message', '');
            }
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'checkOrgStorageLimit',
                'exceptionObj' => e,
                'moreDetails' => 'Error checking org storage limits',
                'apiResponse' => null
            });
            // On error, allow upload (don't block user)
            result.put('hasSpace', true);
            result.put('percentUsed', 0);
            result.put('message', '');
        }
        
        return result;
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

    // Changes are now tracked in wfrecon__Approval_Data__c field
}