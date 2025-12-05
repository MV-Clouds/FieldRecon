public with sharing class GenerateJobSummaryController {

    @AuraEnabled(cacheable=true)
    public static Map<String,Object> getCrewsByJob(String jobId){
        Map<String,Object> result = new Map<String,Object>();
        try {
            // String jobId = 'a0KC300000DB4NNMA1';
            List<wfrecon__Mobilization__c> mobilizationList = [SELECT Id FROM wfrecon__Mobilization__c WHERE wfrecon__Job__c = :jobId WITH USER_MODE];
            
            Set<Id> mobilizationIds = new Set<Id>();
            
            for(wfrecon__Mobilization__c mobilization : mobilizationList){
                mobilizationIds.add(mobilization.Id);
            }
            
            List<wfrecon__Mobilization_Member__c> mobilizationMembers= [SELECT Id,wfrecon__Crew__r.Id,wfrecon__Crew__r.Name FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Mobilization__c IN :mobilizationIds WITH USER_MODE];
            
            System.debug('mobilizationMembers' + mobilizationMembers);
            Map<String,Object> crewInfo = new Map<String,Object>();
            for(wfrecon__Mobilization_Member__c mobilizationMember : mobilizationMembers){
                crewInfo.put(mobilizationMember.wfrecon__Crew__r.Id,mobilizationMember.wfrecon__Crew__r.Name);
            }

            result.put('crewInfo',crewInfo);

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'GenerateJobSummaryController', 'methodName' => 'getCrewsByJob', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('error', 'Error : Failed in getCrewsByJob ' + e.getMessage());
        }
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static Map<String,Object> getUserDesignation(String jobId){
        Map<String,Object> result = new Map<String,Object>();
        try {
            wfrecon__Job__c jobToSummarize = [SELECT Id,Job_Manager__c FROM wfrecon__Job__c WHERE id =:jobId];
            result.put('isJobManager',UserInfo.getUserId() == jobToSummarize.Job_Manager__c);
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'GenerateJobSummaryController', 'methodName' => 'getUserDesignation', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('error', 'Error : Failed in getUserDesignation ' + e.getMessage());
        }
        return result;
    }
    
    @AuraEnabled
    public static Map<String, Object> getJobSummaryPrompts(){
        Map<String, Object> result = new Map<String, Object>();
        try {
            List<AI_Prompt_Library__c> prompts = [SELECT Id, Prompt_Name__c, Prompt_Body__c FROM AI_Prompt_Library__c WHERE Prompt_Type__c IN ('Job Summary') ORDER BY LastModifiedDate DESC];
            result.put('prompts',prompts);
            result.put('success', true);
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'GenerateJobSummaryController', 'methodName' => 'getJobSummaryPrompts', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('error', 'Error : Failed to fetch Job Summary Prompts ' + e.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static Map<String,Object> getSummaryAsHtml(String jobSummaryId) {
        Map<String,Object> result = new Map<String,Object>();
        try {
            if(String.isBlank(jobSummaryId)){
                result.put('error', 'Error : jobSummaryId is required');
                return result;
            }

            FR_Job_AI_Settings__c aiSettings = FR_Job_AI_Settings__c.getOrgDefaults();
            String htmlContentVfPage = aiSettings.HTML_Content_VF_Page__c;
            if(String.isBlank(htmlContentVfPage)){
                result.put('error', 'Error : HTML Content VF Page is not configured in AI Settings');
                return result;
            }

            // Pass the jobSummaryId to VF page to render HTML content
            String vfURL = Site.getBaseUrl() + '/apex/'+htmlContentVfPage+'?jobSummaryId='+jobSummaryId;
            Blob htmlContentBlob = new PageReference(vfURL).getContent();
            result.put('htmlContent', htmlContentBlob.toString());
            System.debug('htmlContent : '+ htmlContentBlob.toString());
            
            // If the Job Summary is temporary, delete it after fetching HTML content
            List<Job_Summary_AI__c> jsaList = [SELECT Id, Is_Temporary__c FROM Job_Summary_AI__c WHERE Id = :jobSummaryId LIMIT 1];
            if(jsaList.size() > 0 && jsaList[0].Is_Temporary__c == true){
                delete as user jsaList[0];
            }

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'GenerateJobSummaryController', 'methodName' => 'getSummaryAsHtml', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('error', 'Error : Failed in generateJobSummary ' + e.getMessage());
        }
        return result;
    }

}