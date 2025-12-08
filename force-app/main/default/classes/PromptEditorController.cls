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

            Map<String, Object> ai_response = validatePrompt(prompt.Prompt_Type__c, prompt.Prompt_Body__c);
            System.debug('ai_response : ' + ai_response);
            if(ai_response.containsKey('ai_Response_Error__c')){
                result.put('error', 'Error while validating prompt. Please try again');
                return result;
            }
            else if(ai_response.containsKey('ai_Response__c')){
                Map<String, Object> aiResponse = (Map<String, Object>) JSON.deserializeUntyped(String.valueOf(ai_response.get('ai_Response__c')));
                Boolean is_valid_prompt = (Boolean) aiResponse.get('is_valid_prompt');
                if(is_valid_prompt == false){
                    result.put('reason_for_invalid', String.valueOf(aiResponse.get('reason_for_invalid') ?? 'The Prompt is not valid against its use case. Please change the prompt and try again.'));
                    return result;
                }
            }

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

    public static Map<String, Object> validatePrompt(String promptType, String promptBody){

        List<AI_Defaults__mdt> ai_defaults_records = [SELECT Prompt_for_Prompt_Validation__c, Prompt_Validation_Generate_Config__c FROM AI_Defaults__mdt WHERE DeveloperName = 'AI_Defaults' LIMIT 1];
        AI_Defaults__mdt ai_defaults = ai_defaults_records.size() > 0 ? ai_defaults_records[0] : new AI_Defaults__mdt();

        String validityPrompt = ai_defaults.Prompt_for_Prompt_Validation__c;
        if(String.isBlank(validityPrompt)){
            validityPrompt = 'As an expert prompt validator, Please validate Given User Prompt Based on its use-case. Prompt to Validate: {#prompt_body} Prompt Use case: {#prompt_use_case} Note: User no need to provide data in its prompt, it will added by grounding. so only focus on what user in asking in prompt against its use-case. ###prompt_use_case### { "Job Summary" : "to provide job and its information summary. most command valid prompt for this use case is: Summarize the job and its shift log entries.", "Shift End Log Summary" : "to provide shift end log/work log summary/information/detail from its associated work logs/information/details (will not be included in prompt). most command valid prompt for this use case is: Detail contains work log information about each crew member. Provide Some Detailed information about the work had been done on shift based on detail." }';
        }

        String useCaseJSON = validityPrompt.substringAfter('###prompt_use_case###');
        validityPrompt = validityPrompt.substringBefore('###prompt_use_case###');

        Map<String, Object> useCases = (Map<String, Object>) JSON.deserializeUntyped(useCaseJSON);
        System.debug('useCases : ' + useCases);
        String useCase = String.valueOf(useCases.get(promptType)) ?? '';
        
        // if useCase is not available, don't validate prompt....
        if(String.isBlank(useCase)) return new Map<String, Object>{};
        
        validityPrompt = validityPrompt.replace('{#prompt_use_case}', useCase);
        validityPrompt = validityPrompt.replace('{#prompt_body}', promptBody);

        String generateConfig = ai_defaults.Prompt_Validation_Generate_Config__c ?? '{ "responseMimeType": "application/json", "responseJsonSchema": { "type": "object", "properties": { "is_valid_prompt": { "type": "boolean", "description": "Mark it as true if the user prompt is clear, complete, and suitable for its use-case otherwise, false." }, "reason_for_invalid": { "type": "string", "description": "Provide a reason why prompt is invalid in most understandable tone and language (max 15-20 words)." } }, "required": [ "is_valid_prompt", "reason_for_invalid" ] } }';

        String requestBody = '{' + 
            '"contents": [' + 
                '{' + 
                    '"parts": [' + 
                        '{"text": ' + JSON.serialize(validityPrompt) + '}' +
                    ']' + 
                '}' + 
            '],' + 
            '"generationConfig": ' + generateConfig+
        '}';


        return AICalloutController.callGeminiAPI(requestBody);
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