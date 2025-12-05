public with sharing class PromptEditorController {



    @AuraEnabled
    public static Map<String, Object> getPrompts(){
        Map<String, Object> result = new Map<String, Object>();
        try {
            
            List<AI_Prompt_Library__c> prompts = [SELECT Id, Prompt_Name__c, Prompt_Body__c,  Prompt_Type__c, CreatedBy.Name, CreatedDate, LastModifiedDate, LastModifiedBy.Name FROM AI_Prompt_Library__c WHERE Prompt_Type__c IN ('Job Summary', 'Shift End Log Summary') ORDER BY LastModifiedDate DESC];
            
            Map<String, List<AI_Prompt_Library__c>> promptsByType = new Map<String, List<AI_Prompt_Library__c>>();
            for(AI_Prompt_Library__c prompt : prompts){
                if(promptsByType.containsKey(prompt.Prompt_Type__c)){
                    List<AI_Prompt_Library__c> promptList = promptsByType.get(prompt.Prompt_Type__c);
                    promptList.add(prompt);
                    promptsByType.put(prompt.Prompt_Type__c, promptList);
                }else{
                    promptsByType.put(prompt.Prompt_Type__c, new List<AI_Prompt_Library__c>{prompt});
                }
            }

            result.put('prompts',promptsByType);
            result.put('success', true);
        
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'PromptEditorController', 'methodName' => 'getPrompts', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('catch_error', e.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static Map<String, Object> savePrompt(AI_Prompt_Library__c prompt, Boolean isCreate){
         Map<String, Object> result = new Map<String, Object>();
        try {

            if(isCreate == true){
                insert as user prompt;
            }
            else if(prompt.Id == null){
                result.put('error', 'Prompt Not available in system please try again');
                return result;
            }
            else{
                update as user prompt;
            }

            List<AI_Prompt_Library__c> promptsToSave = [SELECT Id, Prompt_Name__c, Prompt_Body__c,  Prompt_Type__c, CreatedBy.Name, CreatedDate, LastModifiedDate, LastModifiedBy.Name FROM AI_Prompt_Library__c WHERE Id =: prompt.Id LIMIT 1];
            result.put('prompt', promptsToSave[0]);
            result.put('success', true);

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'PromptEditorController', 'methodName' => 'savePrompt', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('catch_error', e.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static Map<String, Object> deletePrompt(String promptId, Boolean isCreate){
         Map<String, Object> result = new Map<String, Object>();
        try {

            List<AI_Prompt_Library__c> promptsToDelete = [SELECT Id FROM AI_Prompt_Library__c WHERE Id =: promptId LIMIT 1];

            if(promptsToDelete.isEmpty()){
                result.put('error', 'Prompt Not available in system, please try again!');
                return result;
            }

            delete as user promptsToDelete;
            result.put('success', true);

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'PromptEditorController', 'methodName' => 'deletePrompt', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('catch_error', e.getMessage());
        }
        return result;
    }
    
}