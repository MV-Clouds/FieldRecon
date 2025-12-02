public without sharing class CollectShiftRecordingsController {
    
    @AuraEnabled
    public static Map<String, Object> getSavedClips(String paramString){
        Map<String, Object> result = new Map<String, Object>();
        try {

            InputParams params = (InputParams) JSON.deserialize(paramString, InputParams.class);

            System.debug('params : ' + params);
            System.debug('params.jobId : ' + params.jobId);

            // Collect Mobilization Id for the given crew leader
            Map<String, String> mobRes = getMobilization(params);
            if(mobRes.containsKey('error')) return mobRes;

            // merge mobilizationId and crewLeaderId
            result.putAll(mobRes);
            List<ContentVersion> clipList = getCVofMobilization(mobRes.get('mobilizationId'));
    
            result.put('clips', clipList);
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'CollectShiftRecordingsController', 'methodName' => 'getSavedClips', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('error', e.getMessage());
        }
        return result;
    }

    public static List<ContentVersion> getCVofMobilization(String mobilizationId){
        try {

            // First collect all ContentDocumentLink records for the given mobilization Id
            List<ContentDocumentLink> cdl = [SELECT ContentDocument.LatestPublishedVersionId FROM ContentDocumentLink WHERE LinkedEntityId =: mobilizationId];
            // Now collect all ContentVersion Id for the collected ContentDocumentLink records
            Set<Id> cvIds = new Set<Id>();
            for(ContentDocumentLink cdlRec : cdl){
                cvIds.add(cdlRec.ContentDocument.LatestPublishedVersionId);
            }
            // Note: If you directly query ContentVersion with FirstPublishLocationId, it may not return all records due to file sharing settings
            // So you must need to query it using Ids of all content versions.
            // So collect all ContentVersion Id from ContentDocumentLink records and then query ContentVersion using those Ids.
            List<ContentVersion> clipList = [SELECT Id, FirstPublishLocationId, VersionData, VersionDataUrl, CreatedDate, FileExtension, ContentSize, CreatedBy.Name FROM ContentVersion WHERE Id IN: cvIds ORDER BY CreatedDate Desc];

            return clipList;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'CollectShiftRecordingsController', 'methodName' => 'collectContentVerionsOfMobilization', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return new List<ContentVersion>();
        }
    }


    @AuraEnabled
    public static Map<String, Object> saveClipToMobilization(String paramString){
        Map<String, Object> result = new Map<String, Object>();
        try {

            InputParams params = (InputParams) JSON.deserialize(paramString, InputParams.class);

            if(String.isBlank(params.mobilizationId)) {
                // Collect Mobilization Id for the given crew leader
               Map<String, String> mobRes = getMobilization(params);
               if(mobRes.containsKey('error')) return mobRes;

               params.mobilizationId = mobRes.get('mobilizationId');

               // merge mobilizationId and crewLeaderId
               result.putAll(mobRes);
            }

            Id userId = UserInfo.getUserId();
            Contact userContact = [SELECT Id, Name  FROM Contact  WHERE wfrecon__User__c = :userId WITH USER_MODE LIMIT 1];
            
            ContentVersion clip = new ContentVersion();
            clip.FirstPublishLocationId = params.mobilizationId;
            clip.VersionData = EncodingUtil.base64Decode(params?.clipData?.substringAfter('base64,'));
            clip.Title = userContact.Name + ' - ' + DateTime.now().format('yyyy-MM-dd HH:mm:ss');
            clip.PathOnClient = clip.Title+'.'+params?.clipExtension.substringAfter('/');
            insert clip;

            ContentVersion newClip = [SELECT Id, FirstPublishLocationId, VersionData, VersionDataUrl, CreatedDate, FileExtension, ContentSize, CreatedBy.Name, ContentDocumentId FROM ContentVersion WHERE Id =: clip.Id LIMIT 1];

            result.put('newClip', newClip);

            result.put('success', 'Success');
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'CollectShiftRecordingsController', 'methodName' => 'saveClipToMobilization', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('error', e.getMessage());
        }
        return result;
    }

    public static Map<String, String> getMobilization(InputParams params){
        Map<String, String> result = new Map<String, String>();

        // return if job id is not present
        if(String.isBlank(params?.jobId)) {
            result.put('error', 'Job id not available');
            return result;
        }

        // If crew leader id is not present, try to re-collect it...
        // if(String.isBlank(params?.crewLeaderId)) {
        //     Map<String, String> crewLeaderResult = getCrewLeaderId();
        //     // Still not present, return error
        //     if(crewLeaderResult.containsKey('error')) {
        //         result.put('error', crewLeaderResult.get('error'));
        //         return result;
        //     }
        //     else{
        //         params.crewLeaderId = crewLeaderResult.get('crewLeaderId');
        //         result.put('crewLeaderId', crewLeaderResult.get('crewLeaderId'));
        //     }
        // }

        List<Contact> userContact = [SELECT Id FROM Contact WHERE wfrecon__User__c =: UserInfo.getUserId() WITH USER_MODE LIMIT 1];
        if(userContact.isEmpty()){
            result.put('error', 'User contact not available');
            return result;
        }

        Date today = Date.today();
        String todayStr = String.valueOf(today);
        List<wfrecon__Mobilization_Member__c> mobMemberList = [SELECT Id, wfrecon__Contact__c, wfrecon__Mobilization__c, wfrecon__Crew_Leader_Id__c FROM wfrecon__Mobilization_Member__c 
                                                                    WHERE (wfrecon__Contact__c =: userContact[0].Id) AND 
                                                                    (wfrecon__Mobilization__r.wfrecon__Job__c =: params?.jobId) AND 
                                                                    (wfrecon__Mobilization__r.wfrecon__Start_Date_Text__c = :todayStr) 
                                                                    LIMIT 1];
        if(mobMemberList.isEmpty()){
            result.put('error', 'No mobilizations found for today');
            return result;
        }

        // params.crewLeaderId = String.valueOf(mobMemberList[0].wfrecon__Crew_Leader_Id__c);
        // result.put('crewLeaderId', params.crewLeaderId);
        result.put('mobilizationId', mobMemberList[0].wfrecon__Mobilization__c);

        // List<wfrecon__Mobilization__c> mobList = [SELECT Id, Name  FROM wfrecon__Mobilization__c  WHERE wfrecon__Job__c = :params.jobId 
        //                                     AND Id IN (SELECT wfrecon__Mobilization__c FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Crew_Leader_Id__c = : params.crewLeaderId)
        //                                     AND (wfrecon__Start_Date_Text__c = :todayStr)
        //                                     WITH USER_MODE
        //                                     ORDER BY wfrecon__Start_Date_Text__c DESC];

        // if (mobList.isEmpty()) {
        //     result.put('error', 'No mobilizations found for the selected crew leader');
        //     return result;
        // }

        // result.put('mobilizationId', mobList[0].Id);

        return result;
    }

    // public static Map<String, String> getCrewLeaderId(){
    //     Map<String, String> result = new Map<String, String>();
    //     try {
    //         Id userId = UserInfo.getUserId();
    //         Contact userContact = [SELECT Id, User__c  FROM Contact  WHERE wfrecon__User__c = :userId WITH USER_MODE LIMIT 1];
    
    //         if(userContact == null) {
    //             result.put('error', 'User contact not available');
    //             return result;
    //         }
            
    //         result.put('crewLeaderId', String.valueOf(userContact.Id));
    //         return result;
    //     } catch (Exception e) {
    //         result.put('error', e.getMessage());
    //         return result;
    //     }
    // }

    @AuraEnabled
    public static Map<String, String> deleteClip(String cvId){
        Map<String, String> result = new Map<String, String>();
        try {

            if(String.isBlank(cvId)){
                result.put('error', 'Clip id not available');
                return result;
            }

            ContentDocument clipCD = [SELECT Id FROM ContentDocument WHERE LatestPublishedVersionId =: cvId WITH USER_MODE LIMIT 1];
            delete as user clipCD;

            result.put('success', 'Clip deleted successfully');
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'CollectShiftRecordingsController', 'methodName' => 'saveClipToMobilization', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('error', e.getMessage());
        }
        return result;
    }


    @AuraEnabled
    public static Map<String, Object> collectShiftLogInfo(String paramString){
        Map<String, Object> result = new Map<String, Object>();
        try {

            InputParams params = (InputParams) JSON.deserialize(paramString, InputParams.class);
            System.debug('params : ' + params);

            if(String.isEmpty(params.mobilizationId)){
                // Collect Mobilization Id for the given crew leader
                Map<String, String> mobRes = getMobilization(params);
                if(mobRes.containsKey('error')) return mobRes;
    
                // merge mobilizationId and crewLeaderId
                result.putAll(mobRes);

                // collected mobilization Id
                params.mobilizationId = mobRes.get('mobilizationId');
            }
    
            List<ContentVersion> clipList = getCVofMobilization(params.mobilizationId);

            if(clipList.isEmpty()){
                result.put('no_recording', 'No recordings found');
                return result;
            }

            Integer totalClipSize = 0;
            List<String> clipIds = new List<String>();
            for(ContentVersion clip : clipList){
                totalClipSize += clip.ContentSize;
                clipIds.add(clip.Id);
            }
            result.put('totalClipSize', totalClipSize);

            // if totalClipSize is less than 5 MB, then call AI to summarize the clips
            if(totalClipSize <= 0.40 * 1024 * 1024){
                return ProcessShiftLogsByAI(clipIds);
            }
            else{
                // process recorded shift log in future method to increase the limit
                ProcessShiftLogsByAI_Async(JSON.serialize(clipIds));
                result.put('is_async', true);
                return result;
            }
        } catch (Exception e) {
            // Log the exception but don't fail the main transaction
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController','methodName' => 'collectShiftLogInfo','exceptionObj' => e});
            System.debug('Error sending custom notification: ' + e.getMessage());
            result.put('error', 'Something Went Wrong While Collecting Shift Log Info!');
        }
        
        return result;
    }

    public static Map<String, Object> ProcessShiftLogsByAI(List<String> clipIds){
        try {

            List<ContentVersion> clipList = [SELECT Id, VersionData FROM ContentVersion WHERE Id IN : clipIds ORDER BY CreatedDate];

            String audioData = '';
            for(ContentVersion clip : clipList) {
                // System.debug(clip.Title + ' ' + EncodingUtil.base64Encode(clip.VersionData));
                audioData += EncodingUtil.base64Encode(clip.VersionData);
            }
            
            return AICalloutController.generateRecordingSummary(audioData);
            
        } catch (Exception e) {
            System.debug('Error in ProcessShiftLogsByAI: ' + e.getMessage());
            return new Map<String, Object>{ 'error' => 'error in ProcessShiftLogsByAI: ' + e.getMessage()};
        }
    }


    @future(callout=true)
    public static void ProcessShiftLogsByAI_Async(String clipIdsString){
        List<Object> clipIds =  (List<Object>) JSON.deserializeUntyped(clipIdsString);
        List<String> actualClipIds = new List<String>();
        for (Object clipId : clipIds) {
            actualClipIds.add((String) clipId);
        }

        // Call AI to summarize the clips
        Map<String, Object> ai_result = ProcessShiftLogsByAI(actualClipIds);

        System.debug('AI Response: ' + ai_result);

        // Collect and assign values to event fields
        AI_Response__e  aiResponse = new AI_Response__e();
        aiResponse.ai_Response__c = (String) ai_result.get('ai_Response__c');
        aiResponse.ai_Response_Error__c = (String) ai_result.get('ai_Response_Error__c');

        // Publish the event
        Database.SaveResult sr = EventBus.publish(aiResponse);
        if (sr.isSuccess()) {
            System.debug('Successfully published the event.');
        } else {
            System.debug('Failed to publish the event.');
            System.debug('Errors: ' + sr.getErrors());
        }
    }


    public class InputParams{
        @AuraEnabled public String jobId;
        @AuraEnabled public String crewLeaderId;
        @AuraEnabled public String mobilizationId;
        @AuraEnabled public String clipData;
        @AuraEnabled public String clipExtension;
    }
}