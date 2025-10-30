public with sharing class ShiftEndLogV2Controller {

    public static final String CLASSNAME = 'ShiftEndLogV2Controller';

    @AuraEnabled
    public static List<ShiftEndLogWrapper> getShiftEndLogs(Id jobId) {
        List<ShiftEndLogWrapper> wrapperList = new List<ShiftEndLogWrapper>();

        try {
            List<Log_Entry__c> shiftEndLogs = [SELECT Id, Name, wfrecon__Job__c, wfrecon__Work_Performed__c, wfrecon__Work_Performed_Date__c, 
                            wfrecon__Log_Type__c, wfrecon__Exceptions__c, wfrecon__Plan_for_Tomorrow__c, 
                            CreatedBy.Name, CreatedDate, LastModifiedDate
                FROM Log_Entry__c 
                WHERE wfrecon__Job__c = :jobId 
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

    public class ShiftEndLogWrapper {
        @AuraEnabled public Log_Entry__c logEntry { get; set; }
        @AuraEnabled public List<ContentVersion> images { get; set; }
    }
}