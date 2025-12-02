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

    @AuraEnabled
    public static Map<String, Object> getAIPrompts(){
        Map<String, Object> result = new Map<String, Object>();
        try {
            List<AI_Prompt_Library__c> prompts = [SELECT Id, Name, Prompt_Type__c, Prompt_Body__c FROM AI_Prompt_Library__c WHERE Prompt_Type__c IN ('Job Summary', 'Shift Log Recording Summary') ORDER BY CreatedDate DESC];
            result.put('prompts', prompts);
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'AIAdminDashboardController', 'methodName' => 'getFRaiPrompts', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('error', 'Error : Failed to Fetch AI Prompts ' + e.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static Map<String, Object> updateAIPrompts(Map<String, Object> ai_prompts){
        Map<String, Object> result = new Map<String, Object>();
        try {

            List<AI_Prompt_Library__c> prompts = new List<AI_Prompt_Library__c>();
            For(String key : ai_prompts?.keySet()){
                Map<String, Object> p = (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(ai_prompts.get(key)));
                String value = String.valueOf(p.get('value'));
                String type = String.valueOf(p.get('type'));
                if(String.isNotEmpty(type)){
                    AI_Prompt_Library__c prompt = new AI_Prompt_Library__c(
                        Id = String.valueOf(p.get('Id')),
                        Prompt_Body__c = String.valueOf(p.get('value')),
                        Prompt_Type__c = String.valueOf(p.get('type'))
                    );
                    prompts.add(prompt);
                }
            }

            if(!prompts.isEmpty()){
                upsert as user prompts;
            }
            
            result.put('success', 'success');
            result.putAll(getAIPrompts());
            
        } catch (Exception e) {
           ExceptionHandler.logException(new Map<String, Object>{'className' => 'AIAdminDashboardController', 'methodName' => 'updateAIPrompts', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('error', 'Error : Failed to Update AI Prompts ' + e.getMessage());
        }
        return result;
    }
}