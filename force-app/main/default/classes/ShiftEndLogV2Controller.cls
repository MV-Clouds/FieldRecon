public with sharing class ShiftEndLogV2Controller {

    public static final String CLASSNAME = 'ShiftEndLogV2Controller';

    @AuraEnabled
    public static List<ShiftEndLogWrapper> getShiftEndLogs(Id jobId) {
        List<ShiftEndLogWrapper> wrapperList = new List<ShiftEndLogWrapper>();

        try {
            List<Log_Entry__c> shiftEndLogs = [SELECT Id, Name, Job__c, Work_Performed__c, Work_Performed_Date__c, 
                            Log_Type__c, Exceptions__c, Plan_for_Tomorrow__c, 
                            CreatedBy.Name, CreatedDate, LastModifiedDate
                FROM Log_Entry__c 
                WHERE Job__c = :jobId 
                WITH USER_MODE
                ORDER BY CreatedDate DESC];

            Set<Id> logIds = new Set<Id>();
            for(Log_Entry__c log : shiftEndLogs) {
                logIds.add(log.Id);
            }

            Map<Id, List<ContentVersion>> logImagesMap = new Map<Id, List<ContentVersion>>();
            if(!logIds.isEmpty()) {
                List<ContentDocumentLink> contentLinks = [SELECT Id, LinkedEntityId, ContentDocumentId, 
                                   ContentDocument.LatestPublishedVersionId
                        FROM ContentDocumentLink 
                        WHERE LinkedEntityId IN :logIds
                        WITH USER_MODE];

                Set<Id> versionIds = new Set<Id>();
                Map<Id, Id> versionToLogMap = new Map<Id, Id>();
                for(ContentDocumentLink cdl : contentLinks) {
                    versionIds.add(cdl.ContentDocument.LatestPublishedVersionId);
                    versionToLogMap.put(cdl.ContentDocument.LatestPublishedVersionId, cdl.LinkedEntityId);
                }

                if(!versionIds.isEmpty()) {
                    List<ContentVersion> versions = [SELECT Id, Title, FileExtension, ContentSize, CreatedDate
                            FROM ContentVersion 
                            WHERE Id IN :versionIds 
                            AND FileExtension IN ('jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg')
                            WITH USER_MODE
                            ORDER BY CreatedDate DESC];

                    for(ContentVersion cv : versions) {
                        Id logId = versionToLogMap.get(cv.Id);
                        if(!logImagesMap.containsKey(logId)) {
                            logImagesMap.put(logId, new List<ContentVersion>());
                        }
                        logImagesMap.get(logId).add(cv);
                    }
                }
            }

            for(Log_Entry__c log : shiftEndLogs) {
                ShiftEndLogWrapper wrapper = new ShiftEndLogWrapper();
                wrapper.logEntry = log;
                wrapper.images = logImagesMap.containsKey(log.Id) ? logImagesMap.get(log.Id) : new List<ContentVersion>();
                wrapperList.add(wrapper);
            }

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME, 
                'methodName' => 'getShiftEndLogs', 
                'isApiException' => false, 
                'statusCode' => null, 
                'exceptionObj' => e,
                'moreDetails' => 'Error retrieving Shift End Logs for Job Id: ' + jobId, 
                'apiResponse' => null
            });
        }

        return wrapperList;
    }

    @AuraEnabled
    public static void updateShiftEndLog(Log_Entry__c logEntry) {
        try {
            if(logEntry == null) {
                throw new AuraHandledException('Invalid log entry');
            }

        
            update as user logEntry;

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME, 
                'methodName' => 'updateShiftEndLog', 
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
    public static CrewInfoWrapper getCurrentUserCrewInfo(Id jobId) {
        CrewInfoWrapper crewInfo = new CrewInfoWrapper();

        try {
            // Step 1: Get current user's Contact Id
            Id userId = UserInfo.getUserId();
            Contact userContact = [
                SELECT Id, User__c 
                FROM Contact 
                WHERE User__c = :userId
                WITH USER_MODE
                LIMIT 1
            ];

            if (userContact == null) {
                return crewInfo; // No contact, return empty wrapper
            }

            // Step 2: Get Mobilization records related to the Job
            List<Mobilization__c> mobilizations = new List<Mobilization__c>();
            if (jobId != null) {
                mobilizations = [
                    SELECT Id
                    FROM Mobilization__c
                    WHERE Job__c = :jobId
                    WITH USER_MODE
                ];
            }

            if (mobilizations.isEmpty()) {
                return crewInfo; // No mobilizations, return empty wrapper
            }

            // Step 3: Collect all Crew IDs from Mobilization Members
            Set<Id> mobilizationIds = new Set<Id>();
            for (Mobilization__c mob : mobilizations) {
                mobilizationIds.add(mob.Id);
            }

            Set<Id> crewIdsFromMobilizations = new Set<Id>();
            if (!mobilizationIds.isEmpty()) {
                for (Mobilization_Member__c mobMember : [
                    SELECT Crew__c 
                    FROM Mobilization_Member__c 
                    WHERE Mobilization__c IN :mobilizationIds
                    AND Crew__c != null
                    WITH USER_MODE
                ]) {
                    crewIdsFromMobilizations.add(mobMember.Crew__c);
                }
            }

            // Step 4: Query Crew records where current contact is the Crew Lead
            if (!crewIdsFromMobilizations.isEmpty()) {
                List<Crew__c> leaderCrews = [
                    SELECT Id, Name, Crew_Leader__c
                    FROM Crew__c
                    WHERE Id IN :crewIdsFromMobilizations
                    AND Crew_Leader__c = :userContact.Id
                    WITH USER_MODE
                ];

                if (!leaderCrews.isEmpty()) {
                    crewInfo.crewLeaderId = String.valueOf(userContact.Id);
                    for (Crew__c crew : leaderCrews) {
                        crewInfo.crewIds.add(String.valueOf(crew.Id));
                    }
                }
            }

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'CrewInfoController',
                'methodName' => 'getCurrentUserCrewInfo',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error retrieving crew info for jobId: ' + jobId,
                'apiResponse' => null
            });
        }

        return crewInfo;
    }


    // Wrapper class to return data to LWC
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
    }

}