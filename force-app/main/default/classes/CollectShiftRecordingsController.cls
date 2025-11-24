public with sharing class CollectShiftRecordingsController {
    
    @AuraEnabled
    public static Map<String, Object> getSavedClips(String paramString){
        Map<String, Object> result = new Map<String, Object>();
        try {

            InputParams params = (InputParams) JSON.deserialize(paramString, InputParams.class);

            System.debug('params : ' + params);
            System.debug('params.jobId : ' + params.jobId);

            // Collect Mobilization Id for the given crew leader
            Map<String, String> mobRes = getCrewLeaderMobilization(params);
            if(mobRes.containsKey('error')) return mobRes;

            // merge mobilizationId and crewLeaderId
            result.putAll(mobRes);
    
            List<ContentVersion> clipList = [SELECT Id, FirstPublishLocationId, VersionData, VersionDataUrl, CreatedDate, FileExtension FROM ContentVersion WHERE FirstPublishLocationId =: mobRes.get('mobilizationId') ORDER BY CreatedDate Desc];
    
            result.put('clips', clipList);
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'CollectShiftRecordingsController', 'methodName' => 'getSavedClips', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('error', e.getMessage());
        }

        return result;

    }


    @AuraEnabled
    public static Map<String, Object> saveClipToMobilization(String paramString){
        Map<String, Object> result = new Map<String, Object>();
        try {

            InputParams params = (InputParams) JSON.deserialize(paramString, InputParams.class);

             // Collect Mobilization Id for the given crew leader
            Map<String, String> mobRes = getCrewLeaderMobilization(params);
            if(mobRes.containsKey('error')) return mobRes;

            // merge mobilizationId and crewLeaderId
            result.putAll(mobRes);

            Id userId = UserInfo.getUserId();
            Contact userContact = [SELECT Id, Name  FROM Contact  WHERE wfrecon__User__c = :userId WITH USER_MODE LIMIT 1];
            
            ContentVersion clip = new ContentVersion();
            clip.FirstPublishLocationId = mobRes.get('mobilizationId');
            clip.VersionData = EncodingUtil.base64Decode(params?.clipData?.substringAfter('base64,'));
            clip.Title = userContact.Name + ' - ' + DateTime.now().format('yyyy-MM-dd HH:mm:ss');
            clip.PathOnClient = clip.Title+'.'+params?.clipExtension.substringAfter('/');
            insert clip;

            result.put('newClip', [SELECT Id, FirstPublishLocationId, VersionData, VersionDataUrl, CreatedDate, FileExtension FROM ContentVersion WHERE Id =: clip.Id LIMIT 1]);

            result.put('success', 'Success');
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'CollectShiftRecordingsController', 'methodName' => 'saveClipToMobilization', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('error', e.getMessage());
        }
        return result;
    }

    public static Map<String, String> getCrewLeaderMobilization(InputParams params){
        Map<String, String> result = new Map<String, String>();

        // return if job id is not present
        if(!String.isNotBlank(params?.jobId)) {
            result.put('error', 'Job id not available');
            return result;
        }

        // If crew leader id is not present, try to re-collect it...
        if(!String.isNotBlank(params?.crewLeaderId)) {
            Map<String, String> crewLeaderResult = getCrewLeaderId();
            // Still not present, return error
            if(crewLeaderResult.containsKey('error')) {
                result.put('error', crewLeaderResult.get('error'));
                return result;
            }
            else{
                params.crewLeaderId = crewLeaderResult.get('crewLeaderId');
                result.put('crewLeaderId', crewLeaderResult.get('crewLeaderId'));
            }
        }

        Date today = Date.today();
        String todayStr = String.valueOf(today);
        List<wfrecon__Mobilization__c> mobList = [SELECT Id, Name  FROM wfrecon__Mobilization__c  WHERE wfrecon__Job__c = :params.jobId 
                                            AND Id IN (SELECT wfrecon__Mobilization__c FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Crew_Leader_Id__c = : params.crewLeaderId)
                                            AND (wfrecon__Start_Date_Text__c = :todayStr)
                                            WITH USER_MODE
                                            ORDER BY wfrecon__Start_Date_Text__c DESC];

        if (mobList.isEmpty()) {
            result.put('error', 'No mobilizations found for the selected crew leader');
            return result;
        }

        result.put('mobilizationId', mobList[0].Id);

        return result;
    }

    public static Map<String, String> getCrewLeaderId(){
        Map<String, String> result = new Map<String, String>();
        try {
            Id userId = UserInfo.getUserId();
            Contact userContact = [SELECT Id, User__c  FROM Contact  WHERE wfrecon__User__c = :userId WITH USER_MODE LIMIT 1];
    
            if(userContact == null) {
                result.put('error', 'User contact not available');
                return result;
            }
            
            result.put('crewLeaderId', String.valueOf(userContact.Id));
            return result;
        } catch (Exception e) {
            result.put('error', e.getMessage());
            return result;
        }
    }

    @AuraEnabled
    public static Map<String, String> deleteClip(String cvId){
        Map<String, String> result = new Map<String, String>();
        try {

            if(!String.isNotBlank(cvId)){
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


    public class InputParams{
        @AuraEnabled public String jobId;
        @AuraEnabled public String crewLeaderId;
        @AuraEnabled public String clipData;
        @AuraEnabled public String clipExtension;
    }
}