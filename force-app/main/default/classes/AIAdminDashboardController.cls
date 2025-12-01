public with sharing class AIAdminDashboardController {
   

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getAICustomSetting(){
        Map<String, Object> result = new Map<String, Object>();
        try {
            result.put('customSetting', FR_Job_AI_Settings__c.getOrgDefaults());
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'AIAdminDashboardController', 'methodName' => 'getAICustomSetting', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('error', 'Error : Failed to fetch AI Custom Setting ' + e.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static Map<String, Object> updateAICustomSetting(Map<String, Object> ai_settings){
        Map<String, Object> result = new Map<String, Object>();
        try {
            System.debug('AI Settings to be saved: ' + ai_settings);
            FR_Job_AI_Settings__c aiSettings = FR_Job_AI_Settings__c.getOrgDefaults();
            aiSettings = (FR_Job_AI_Settings__c) JSON.deserialize(JSON.serialize(ai_settings), FR_Job_AI_Settings__c.class);
            System.debug('AI Settings after deserialization: ' + aiSettings);
            upsert as user aiSettings;
            result.put('customSetting', aiSettings);
            result.put('success', 'success');
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'AIAdminDashboardController', 'methodName' => 'getAICustomSetting', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('error', 'Error : Failed to update AI Custom Setting ' + e.getMessage());
        }
        return result;
    }
}