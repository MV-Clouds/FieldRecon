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
                SELECT Id, User__c 
                FROM Contact 
                WHERE User__c = :userId
                WITH USER_MODE
                LIMIT 1
            ];

            System.debug('User Contact: ' + userContact);

            if(userContact != null) {
                // Get Mobilizations related to the job
                List<Mobilization__c> mobilizations = jobId != null 
                    ? [SELECT Id FROM Mobilization__c WHERE Job__c = :jobId WITH USER_MODE] 
                    : new List<Mobilization__c>();

                    System.debug('Found Mobilizations: ' + mobilizations);

                if(!mobilizations.isEmpty()) {
                    Set<Id> mobilizationIds = new Set<Id>();
                    for(Mobilization__c mob : mobilizations){
                        mobilizationIds.add(mob.Id);
                    }

                    System.debug('Found Mobilization IDs: ' + mobilizationIds);

                    // Get Crew IDs from Mobilization Members
                    Set<Id> crewIdsFromMobilizations = new Set<Id>();
                    for(Mobilization_Member__c mm : [
                        SELECT Crew__c 
                        FROM Mobilization_Member__c 
                        WHERE Mobilization__c IN :mobilizationIds
                        AND Crew__c != null
                        WITH USER_MODE
                    ]) {
                        crewIdsFromMobilizations.add(mm.Crew__c);
                    }

                    System.debug('Found Crew IDs from Mobilizations: ' + crewIdsFromMobilizations);

                    // Get Crews where user is leader
                    if(!crewIdsFromMobilizations.isEmpty()) {

                        // Query Crew Member records where user is marked as leader
                        List<Crew_Member__c> leaderCrewMembers = [
                            SELECT Id, Crew__c, Contact__c
                            FROM Crew_Member__c
                            WHERE Crew__c IN :crewIdsFromMobilizations
                            AND Contact__c = :userContact.Id
                            AND Member_Type__c = 'Leader'
                            WITH USER_MODE
                        ];

                        if (!leaderCrewMembers.isEmpty()) {
                            resultWrapper.crewInfo.crewLeaderId = String.valueOf(userContact.Id);

                            for (Crew_Member__c member : leaderCrewMembers) {
                                resultWrapper.crewInfo.crewIds.add(String.valueOf(member.Crew__c));
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
            List<Log_Entry__c> shiftEndLogs = jobId != null
                ? [SELECT Id, Name, Job__c, Work_Performed__c, Work_Performed_Date__c, 
                        Log_Type__c, Exceptions__c, Plan_for_Tomorrow__c, Notes_to_Office__c,
                        CreatedBy.Name, CreatedDate, LastModifiedDate
                   FROM Log_Entry__c 
                   WHERE Job__c = :jobId 
                   AND Log_Type__c = 'Shift End'
                   ORDER BY CreatedDate DESC]
                : new List<Log_Entry__c>();

            Set<Id> logIds = new Set<Id>();
            for(Log_Entry__c log : shiftEndLogs) logIds.add(log.Id);

            // Get current location processes for the job
            Map<Id, List<LocationProcessSnapshot>> jobLocationProcessesMap = new Map<Id, List<LocationProcessSnapshot>>();
            if(jobId != null) {
                List<Location_Process__c> locationProcesses = [
                    SELECT Id, Name, wfrecon__Completed_Percentage__c, wfrecon__Sequence__c,
                           wfrecon__Location__c, wfrecon__Location__r.Name
                    FROM Location_Process__c 
                    WHERE wfrecon__Location__r.wfrecon__Job__c = :jobId 
                    WITH USER_MODE
                    ORDER BY wfrecon__Location__r.Name ASC, wfrecon__Sequence__c ASC NULLS LAST, CreatedDate ASC
                ];

                List<LocationProcessSnapshot> processSnapshots = new List<LocationProcessSnapshot>();
                for(Location_Process__c lp : locationProcesses) {
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
                        AND FileExtension IN ('jpg','jpeg','png','gif','bmp','svg')
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

            for(Log_Entry__c log : shiftEndLogs) {
                ShiftEndLogWrapper wrapper = new ShiftEndLogWrapper();
                wrapper.logEntry = log;
                wrapper.images = logImagesMap.containsKey(log.Id) ? logImagesMap.get(log.Id) : new List<ContentVersion>();
                
                // Get current location processes for this job
                wrapper.locationProcesses = jobLocationProcessesMap.containsKey(log.wfrecon__Job__c) 
                    ? jobLocationProcessesMap.get(log.wfrecon__Job__c) 
                    : new List<LocationProcessSnapshot>();
                
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
    public static void updateShiftEndLogWithImages(Log_Entry__c logEntry, List<String> contentDocumentIdsToDelete) {
        try {
            if(logEntry == null) {
                throw new AuraHandledException('Invalid log entry');
            }

            // Step 1: Delete removed images if any
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

            // Step 2: Update the log entry
            update as user logEntry;

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

            Log_Entry__c logToDelete = new Log_Entry__c(Id = logId);

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
        @AuraEnabled public Log_Entry__c logEntry { get; set; }
        @AuraEnabled public List<ContentVersion> images { get; set; }
        @AuraEnabled public List<LocationProcessSnapshot> locationProcesses { get; set; }
    }

    public class LocationProcessSnapshot {
        @AuraEnabled public String processId { get; set; }
        @AuraEnabled public String processName { get; set; }
        @AuraEnabled public String locationName { get; set; }
        @AuraEnabled public Decimal completionPercentage { get; set; }
        @AuraEnabled public Integer sequence { get; set; }
    }

}