public with sharing class CollectWorkLogsController {

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

            List<wfrecon__Crew_Member__c> crewMembers = [SELECT Id, wfrecon__Member_Type__c FROM wfrecon__Crew_Member__c WHERE wfrecon__Contact__r.wfrecon__User__c =: UserInfo.getUserId()];
            if(crewMembers.isEmpty()){
                result.put('error', 'No crew member found for the current user.');
                return result;
            }

            String mobilizationId = mobRes.get('mobilizationId');
            String userId = UserInfo.getUserId();

            List<ContentVersion> clipList = new List<ContentVersion>();
            if(crewMembers[0]?.wfrecon__Member_Type__c == 'Leader'){
                // If the user in the crew leader, then collect all clips from the mobilization
                clipList = getCVofMobilization(mobilizationId);
            }
            else{
                // if the user in crew member, only shows its own clips
                String clipQuery = getCVFieldsToQuery()+' WHERE FirstPublishLocationId =:mobilizationId AND CreatedById =:userId  ORDER BY CreatedDate Desc';
                clipList = Database.query(clipQuery);
            }
    
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
            String clipQuery = getCVFieldsToQuery() + ' WHERE Id IN: cvIds AND Is_Work_Log_Recording__c = true ORDER BY CreatedDate Desc';
            List<ContentVersion> clipList = Database.query(clipQuery);

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

            String audioData = params?.clipData?.substringAfter('base64,');

            // Summarize Recoding and collect its transcript with help of AI
            Map<String, Object> ai_response = AICalloutController.generateSingleRecordingTranscript(new Map<String, Object>{ 'audio' => audioData});
            System.debug('ai_response : '+ ai_response);
            result.put('ai_response', ai_response);
            if(ai_response.containsKey('ai_Response__c')){

                Map<String, Object> audio_summary = (Map<String, Object>) JSON.deserializeUntyped(String.valueOf(ai_response.get('ai_Response__c')));
                System.debug('audio_summary : '+ audio_summary);
                
                if(Boolean.valueOf(audio_summary.get('no_valid_entry')) == true){
                    result.put('error', 'No valid  work log detail found in the recording.\n Please record again.');
                    return result;
                }

                // Update Content Version/ Recoding File with Transcript for future case
                ContentVersion clip = new ContentVersion();
                clip.Is_Work_Log_Recording__c = true;
                clip.FirstPublishLocationId = params.mobilizationId;
                clip.VersionData = EncodingUtil.base64Decode(audioData);
                clip.PathOnClient = clip.Title+'.'+params?.clipExtension.substringAfter('/');
                clip.Title = userContact.Name + ' - ' + DateTime.now().format('yyyy-MM-dd HH:mm:ss');
                clip.Recoding_Language__c = String.valueOf(audio_summary.get('lang_code')+' ('+audio_summary.get('language')+')');
                clip.Transcript_Native__c = String.valueOf(audio_summary.get('transcript'));
                clip.Transcript_English__c = String.valueOf(audio_summary.get('translation_en'));
                clip.Transcript_Size__c =  Blob.valueOf(clip.Transcript_English__c).size();
                insert clip;

                String clipId = clip.Id;
                String clipQuery = getCVFieldsToQuery() + ' WHERE Id =: clipId LIMIT 1';
                ContentVersion newClip = Database.query(clipQuery);
                // ContentVersion newClip = [SELECT Id, FirstPublishLocationId, VersionData, VersionDataUrl, CreatedDate, FileExtension, ContentSize, CreatedBy.Name, ContentDocumentId, FirstPublishLocation.Name FROM ContentVersion WHERE Id =: clip.Id LIMIT 1];
    
                
                postLogDetailToChatter(JSON.serialize(new Map<String, Object>{
                    'translation_en' => audio_summary.get('translation_en'), 
                    'jobId' => params.jobId, 
                    'clipId' => newClip.Id,
                    'mobilizationId' => params.mobilizationId,
                    'mobilizationName' => newClip.FirstPublishLocation.Name
                }));
                
                result.put('newClip', newClip);
                result.put('success', 'Success');
            }
            else{
                result.put('error', 'Error : Failed to generate transcript for the recording, Please try again.');
            }

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'CollectShiftRecordingsController', 'methodName' => 'saveClipToMobilization', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('catch_error', e.getMessage());
        }
        return result;
    }

    @future(callout=true)
    public static void postLogDetailToChatter(String inputParams){
        try {

            InputParams data = (InputParams) JSON.deserialize(inputParams, InputParams.class); 
            String translation_en = data.translation_en;
            String jobId = data.jobId;
            String clipId = data.clipId;
            String mobilizationId = data.mobilizationId;
            String mobilizationName = data.mobilizationName;

            String orgBaseURL = URL.getOrgDomainURL().toExternalForm();
            List<wfrecon__Mobilization_Member__c> mobMembers = [SELECT Id, wfrecon__Crew__c, wfrecon__Contact__c, wfrecon__Contact__r.Name, wfrecon__Crew_Leader_Id__c FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Contact__r.User__c =: UserInfo.getUserId() WITH USER_MODE];
            wfrecon__Mobilization_Member__c mobMember =  mobMembers.size() > 0 ? mobMembers[0] : new wfrecon__Mobilization_Member__c();
            String member_url = orgBaseURL+'/'+(mobMember.wfrecon__Contact__c ?? UserInfo.getUserId());

            // Create chatter post
            FeedItem feedElement = new FeedItem();
            String richtextBody = ''+
            '<p>'+
            '  <p><b>New Work Log Submitted</b></p>'+
            '  <p>&nbsp</p>'+
            '  <p> A new work-log has been submitted by <b><a href="{#member_url}" rel="noopener noreferrer" target="_blank">{#member_name}</a></b>.</p>'+
            '  <p><b>Details:</b></p>'+
            '  <ul>'+
            '    <li><b>Date: </b>{#today}</li>'+
            '    <li><b>Mobilization: </b><a href="{#mobilization_url}" rel="noopener noreferrer" target="_blank">{#mobilization_name}</a></li>'+
            '  </ul>'+
            '  <p>&nbsp</p>'+
            '  <p><b>Work Log:</b></p>'+
            '  <p>'+
            '    {#transcript}'+
            '  </p>'+
            '</p>'+
            '';
            richtextBody = richtextBody.replace('{#member_url}', member_url);
            richtextBody = richtextBody.replace('{#member_name}', mobMember.wfrecon__Contact__r?.Name ?? UserInfo.getName());
            richtextBody = richtextBody.replace('{#today}', String.valueOf(Date.today()));
            richtextBody = richtextBody.replace('{#mobilization_url}', orgBaseURL+'/'+mobilizationId);
            richtextBody = richtextBody.replace('{#mobilization_name}', mobilizationName);
            richtextBody = richtextBody.replace('{#transcript}', translation_en);
            System.debug('richtextBody : ' + richtextBody);
            feedElement.Body = richtextBody;
            feedElement.ParentId = jobId;
            feedElement.RelatedRecordId = clipId;
            feedElement.IsRichText = true;
            feedElement.Type = 'ContentPost';
            insert feedElement;

            System.debug('feedElement : ' + feedElement);

            // Notify to user and crew leader/boss
            List<CustomNotificationType> notificationTypes = [SELECT Id, DeveloperName  FROM CustomNotificationType WHERE DeveloperName='FR_New_Log_Recording_Notification'];
            if(notificationTypes.size() > 0){
                Messaging.CustomNotification notification = new Messaging.CustomNotification();
                notification.setNotificationTypeId(notificationTypes[0].Id);
                notification.setTitle('New Work Log added!');
                notification.setBody('A new Work Log entry has been added by '+mobMember.wfrecon__Contact__r?.Name ?? UserInfo.getName()+'. Click to review its full transcript and related details.');
                notification.setTargetId(feedElement.Id);
                Set<String> recipientsIds = new Set<String>{UserInfo.getUserId()};
                // Add crew leader to send notification
                if(String.isNotBlank(mobMember.wfrecon__Crew_Leader_Id__c)){
                    List<Contact> crewLeaderContact = [SELECT Id, wfrecon__User__c FROM Contact WHERE Id =: mobMember.wfrecon__Crew_Leader_Id__c WITH USER_MODE LIMIT 1];
                    if(crewLeaderContact.size() > 0 && String.isNotBlank(crewLeaderContact[0].wfrecon__User__c) && crewLeaderContact[0].wfrecon__User__c != UserInfo.getUserId()){
                        recipientsIds.add(crewLeaderContact[0].wfrecon__User__c);
                    }
                }
                notification.send(recipientsIds);
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'CollectShiftRecordingsController', 'methodName' => 'postLogDetailToChatter', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
        }
    }

    public static Map<String, String> getMobilization(InputParams params){
        Map<String, String> result = new Map<String, String>();

        // return if job id is not present
        if(String.isBlank(params?.jobId)) {
            result.put('error', 'Job id not available');
            return result;
        }

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

        result.put('mobilizationId', mobMemberList[0].wfrecon__Mobilization__c);

        return result;
    }

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

            Map<String, String> workLogs = new Map<String,String>();

            Integer totalClipSize = 0;
            Decimal totalTranscriptSize = 0;
            List<String> clipIds = new List<String>();
            for(ContentVersion clip : clipList){
                totalClipSize += clip.ContentSize;
                totalTranscriptSize += clip.Transcript_Size__c;
                clipIds.add(clip.Id);
                workLogs.put(clip.createdBy.Name+' ('+clip.CreatedDate+')', clip.Transcript_English__c);
            }
            result.put('totalClipSize', totalClipSize);

            String transcript = JSON.serialize(workLogs);
            System.debug('transcript : '+ transcript);
            System.debug('transcript size : '+ Blob.valueOf(transcript).size());
            System.debug('Transcript_Size__c '+ totalTranscriptSize);

            // if totalClipSize is less than 5 MB, then call AI to summarize the clips
            if(totalClipSize <= 5 * 1024 * 1024){
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

            List<ContentVersion> clipList = [SELECT Id, Transcript_English__c FROM ContentVersion WHERE Id IN : clipIds ORDER BY CreatedDate];

            String audioData = '';
            String transcript_en = '';
            for(ContentVersion clip : clipList) {
                // audioData += EncodingUtil.base64Encode(clip.VersionData);
                transcript_en += clip.Transcript_English__c;
            }
            
            return AICalloutController.generateRecordingSummary(new Map<String, Object>{ 'audio' => audioData, 'transcript_en' => transcript_en});
            
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

    /**
     * Get the fields to query for ContentVersion
     * @return
     * Reason: At line no 31, 56, 94 (might be changed), you will see the database.query() has been used to query record...
     * this is because to keep query fields same for all these queries, 
     * there might be a chance that developer update the one query(add or remove fields) and forget to update another one...
     * In that case the field will not be available in the record and it will cases issue.
     * So, to avoid this, we are using this approach to query the field to keep fields same for all related query.
     */
    private static String getCVFieldsToQuery(){
        return 'SELECT Id, FirstPublishLocationId, FirstPublishLocation.Name, VersionData, VersionDataUrl, CreatedDate, FileExtension, ContentSize, CreatedBy.Name, Transcript_English__c, ContentDocumentId, Transcript_Size__c FROM ContentVersion';
    }

    public class InputParams{
        @AuraEnabled public String jobId;
        @AuraEnabled public String crewLeaderId;
        @AuraEnabled public String mobilizationId;
        @AuraEnabled public String mobilizationName;
        @AuraEnabled public String clipData;
        @AuraEnabled public String clipExtension;
        @AuraEnabled public String clipId;
        @AuraEnabled public String clipDocumentId;
        @AuraEnabled public String translation_en;
    }
}