/**
* @File Name : AICalloutController.cls
* @Description :
* @Author :
* @Last Modified By :
* @Last Modified On : November 25, 2025
* @Modification Log :
*==============================================================================
* Ver | Date | Author | Modification
*==============================================================================
* 1.0 | November 25, 2025 |   | Initial Version
**/

public with sharing class AICalloutController {

    @AuraEnabled
    public static Map<String, Object> generateSingleRecordingTranscript(Map<String, Object> data) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            String audio = (String) String.valueOf(data.get('audio'));

            List<AI_Defaults__mdt> ai_defaults_records = [SELECT Work_Log_Transcript_Prompt__c, Work_Log_Transcript_GenerateConfig__c FROM AI_Defaults__mdt WHERE DeveloperName = 'AI_Defaults' LIMIT 1];
            AI_Defaults__mdt ai_defaults = ai_defaults_records.size() > 0 ? ai_defaults_records[0] : new AI_Defaults__mdt();
            
            String userPrompt = ai_defaults.Work_Log_Transcript_Prompt__c ?? 'I will provide work Shift Log entry detail in audio form. Audio has information about what work has been done over the working shift or whole day. Please Provide the Transcript for the following audio in the language it has been spoken. Provide language and its code. Translate the Transcript it into english. If there is no Information About Work Detail add No Job Detail In no_valid_entry key, otherwise skip it. Only Provide Response In Mentioned Format/Structure. Note: Always provide JSON within (even if no detail is available) the response as i need parsing JSON. Thank you for your assistance.';

            Map<String, Object> audioData = new Map<String, Object>();
            audioData.put('mime_type', 'audio/webm');
            audioData.put('data', audio);
            String inline_data = JSON.serialize(audioData);
            System.debug('inline_data : '+inline_data);

            String generationConfig = ai_defaults.Work_Log_Transcript_GenerateConfig__c ?? '{"responseMimeType": "application/json", "responseJsonSchema": { "type": "object", "properties": { "language": { "type": "string", "description": "The language detected in the input audio/text." }, "lang_code": { "type": "string", "description": "The ISO 639-1 language code (e.g.,en, hi, fr)." }, "transcript": { "type": "string", "description": "The full verbatim transcript of the speech." }, "translation_en": { "type": "string", "description": "An English translation of the full transcript." }, "no_valid_entry": { "type": "boolean", "description": "Set to true if the input did not contain valid or relevant information for the other fields, otherwise false." } }, "required": [ "language", "lang_code", "transcript", "translation_en", "no_valid_entry" ] }}';

            // Build full request body using content structure
            String requestBody = '{' + 
                '"contents": [' + 
                    '{' + 
                        '"parts": [' + 
                            '{"text": "' + userPrompt + '"},' +
                            '{"inline_data": ' + inline_data + '}' +
                        ']' + 
                    '}' + 
                '],' + 
                '"generationConfig": '+generationConfig+'' + 
            '}';

            result = callGeminiAPI(requestBody);
            // result = {'ai_Response__c' : 'summary'}
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'AICalloutController', 'methodName' => 'generateSingleRecordingTranscript', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('ai_Response_Error__c', 'Error : Failed in generateRecordingSummary ' + e.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static Map<String, Object> generateRecordingSummary(Map<String, Object> audioData) {
        Map<String, Object> result = new Map<String, Object>();
        try {

            // String audio = (String) String.valueOf(audioData.get('audio'));
            String transcript_en = (String) String.valueOf(audioData.get('transcript_en'));

            List<AI_Defaults__mdt> ai_defaults_records = [SELECT Shift_Log_Summary_Prompt_Instruction__c, Shift_Log_Summary_generationConfig__c FROM AI_Defaults__mdt WHERE DeveloperName = 'AI_Defaults' LIMIT 1];
            AI_Defaults__mdt ai_defaults = ai_defaults_records.size() > 0 ? ai_defaults_records[0] : new AI_Defaults__mdt();
            
            // customized user prompt
            String customized_prompt = 'Detail contains work log information about each crew member. Provide Some Detailed information about the work had been done on shift based on detail.';
            
            // build user prompt by adding customized_prompt & prompt instruction
            String userPrompt = ai_defaults.Shift_Log_Summary_Prompt_Instruction__c ?? 'Here is Shift Log Detail: {#transcript_en}. {#customized_prompt} If there is no Information About Work Detail make no_valid_entry to true, otherwise false. Only Provide Response In Mentioned Format/Structure . Thank you for your assistance.';
            userPrompt += userPrompt.replace('{#transcript_en}', transcript_en);
            userPrompt += userPrompt.replace('{#customized_prompt}', customized_prompt);

            // collect generationConfig...
            String generationConfig = ai_defaults.Shift_Log_Summary_generationConfig__c ?? '{ "responseMimeType": "application/json", "responseJsonSchema": { "type": "object", "properties": { "info": { "type": "string", "description": "General summary or context of the input." }, "whatWeDone": { "type": "string", "description": "Summary (about 50 or more words) work completed by me or my crew today or in the specified period, including specific achievements and key results. Keep me and my crew as subject." }, "planForTomorrow": { "type": "string", "description": "A detailed plan (about 50 or more words) for the next day, including prioritized tasks, required resources, and anticipated outcomes." }, "notesToOffice": { "type": "string", "description": "Any specific notes, requests, or messages to be communicated to the office or management (e.g., supplies needed, meeting requests). If no information available then leave this blank" }, "exceptions": { "type": "string", "description": "Any issues, blockers, or unusual circumstances encountered. If no information available then leave this blank" }, "no_valid_entry": { "type": "boolean", "description": "Set to true if the input did not contain valid or relevant information for the other fields, otherwise false." } }, "required": [ "info", "whatWeDone", "planForTomorrow", "notesToOffice", "exceptions", "no_valid_entry" ] } }';

            // Build full request body using content structure
            String requestBody = '{' + 
                '"contents": [' + 
                    '{' + 
                        '"parts": [' + 
                            '{"text": "' + userPrompt + '"}' +
                        ']' + 
                    '}' + 
                '],' + 
                '"generationConfig": '+generationConfig+
            '}';

            result = callGeminiAPI(requestBody);
            // result = {'ai_Response__c' : 'summary'}
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'AICalloutController', 'methodName' => 'generateRecordingSummary', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('ai_Response_Error__c', 'Error : Failed in generateRecordingSummary ' + e.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static Map<String,Object> generateJobSummary(String inputData) {
        Map<String,Object> result = new Map<String,Object>();
        try {
            
            System.debug('InputData : '+ inputData);
            RequestInput input = (RequestInput)JSON.deserialize(inputData, RequestInput.class);
            String jobId = input.jobId;
            String startDate = input.startDate;
            String endDate = input.endDate;
            String language = input.language ?? 'English';
            String durationType = input.durationType ?? 'all';
            String workChoice = input.workVisibility ?? 'my_work';
            List<String> crews = input.crews ?? new List<String>();
            Boolean avoidHtmlContent = input.avoidHtmlContent ?? false;
            String promptId = input.promptId;
            
            String userId = UserInfo.getUserId();
            List<String> clausePart = new List<String>();
            clausePart.add('wfrecon__Job__c = :jobId');
            
            if(durationType == 'custom_Duration'){
                // Convert string inputs to Date
                Date startDt = Date.valueOf(startDate);
                Date endDt   = Date.valueOf(endDate);
                clausePart.add('(wfrecon__Work_Performed_Date__c >= :startDt AND wfrecon__Work_Performed_Date__c <= :endDt)');
            }else if(durationType == 'this_Week'){
                Integer daysFromWeekStart = weekDay() - 1;
                clausePart.add('wfrecon__Work_Performed_Date__c >= LAST_N_DAYS: ' + daysFromWeekStart);
            }

            // Need To Review Start
            wfrecon__Job__c jobToSummarize = [SELECT Id, Name, CreatedDate, LastModifiedDate, Job_Manager__c, wfrecon__Account__c, wfrecon__Actual_Man_Hours__c, wfrecon__Architect__c, wfrecon__City__c, wfrecon__Click_for_Map__c, wfrecon__Complete__c, wfrecon__Completion_Date__c, wfrecon__Contract_Date__c, wfrecon__Country__c, wfrecon__County__c, wfrecon__Description__c, wfrecon__FIPS_County__c, wfrecon__FIPS_State__c, wfrecon__Geocode__Latitude__s, wfrecon__Geocode__Longitude__s, wfrecon__Geocode__c, wfrecon__Job_Address__c, wfrecon__Job_Name__c, wfrecon__Job_Number__c, wfrecon__Need_Hotels__c, wfrecon__Parent_Job__c, wfrecon__Per_Diem__c, wfrecon__QB_Customer_Id__c, wfrecon__Retainage__c, wfrecon__State__c, wfrecon__Status__c, wfrecon__Street__c, wfrecon__Sync_Token__c, wfrecon__Title__c, wfrecon__Total_Budgeted_Man_Hours__c, wfrecon__Total_Budgeted_Material_Cost__c, wfrecon__Total_Contract_Price__c, wfrecon__Total_Job_Material_Expense__c, wfrecon__Value_of_Current_Completed_Work__c, wfrecon__Zip_Code__c, wfrecon__End_Date_Rollup__c, wfrecon__Mobilization_Count__c, wfrecon__Start_Date_Rollup__c, wfrecon__Total_Change_Order_Value__c, wfrecon__Total_Contract_Value__c, wfrecon__Address__c, wfrecon__Client_Name__c, wfrecon__Job_Link__c, wfrecon__Remaining_Budgeted_Man_Hours__c, wfrecon__Remaining_Budgeted_Material_Cost__c, wfrecon__Status_Light__c, wfrecon__Total_Man_Hours__c FROM wfrecon__Job__c WHERE Id = :jobId ];
            
            Set<Id> mobIds = new Set<Id>();
            if(userId == jobToSummarize.Job_Manager__c && workChoice == 'specific_Crew' && crews.size() > 0){
                List<wfrecon__Mobilization_Member__c> mobMeb = [SELECT Id, wfrecon__Mobilization__c FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Crew__c IN :crews AND wfrecon__Mobilization__r.wfrecon__Job__c =: jobId];
                for(wfrecon__Mobilization_Member__c mb : mobMeb){
                    mobIds.add(mb.wfrecon__Mobilization__c);
                }
                clausePart.add('wfrecon__Mobilization__c IN :mobIds');
            }
            else if(userId != jobToSummarize.Job_Manager__c || workChoice == 'my_work'){
               clausePart.add('CreatedById = :userId');
            }

            clausePart.add('wfrecon__Work_Performed_Date__c != NULL');

            String whereClause = clausePart.size() > 0 ? (' WHERE ' + String.join(clausePart, ' AND ')) : '';

            List<wfrecon__Log_Entry__c> logEntries = Database.query('SELECT Name, wfrecon__Approval_Data__c, wfrecon__Approved_Date__c, wfrecon__Exceptions__c, wfrecon__Log_Type__c, wfrecon__Material_Usage_Complete__c, wfrecon__Notes_to_Office__c, wfrecon__Plan_for_Tomorrow__c, wfrecon__Processes_Updated__c, wfrecon__Status__c, wfrecon__Time_Entries_Complete__c, wfrecon__Travel_Log_Complete__c, wfrecon__Work_Performed__c, wfrecon__Work_Performed_Date__c FROM wfrecon__Log_Entry__c' + whereClause +' ORDER BY wfrecon__Work_Performed_Date__c ASC');
            System.debug('logEntries : '+ logEntries);

            // collect use customized prompt
            String customized_prompt = 'Summarize the job and its shift log entries.';
            if(String.isNotBlank(promptId)){
                List<AI_Prompt_Library__c> promptList = [SELECT Id, Name, Prompt_Type__c, Prompt_Body__c FROM AI_Prompt_Library__c WHERE Id =: promptId LIMIT 1];
                if(promptList?.size() > 0) customized_prompt = promptList[0].Prompt_Body__c;
            }

            // collect default values for the AI API callout
            List<AI_Defaults__mdt> ai_defaults_records = [SELECT Job_Summary_Prompt_Instruction__c, Job_Summary_generationConfig__c FROM AI_Defaults__mdt WHERE DeveloperName = 'AI_Defaults' LIMIT 1];
            AI_Defaults__mdt ai_defaults = ai_defaults_records.size() > 0 ? ai_defaults_records[0] : new AI_Defaults__mdt();

            String prompt_instruction = ai_defaults.Job_Summary_Prompt_Instruction__c ?? 'Carefully comprehend the above message and strictly give response based on Job and its shift log entries in the "expected format" even if no log entries is present. Response Detail Must be in following language: {#language}. Here is Detail of Job Record: {#job} and  Daily logs {#log_entries}. Thank you for your assistance.';
            prompt_instruction = prompt_instruction.replace('{#language}', language);
            prompt_instruction = prompt_instruction.replace('{#job}', JSON.serialize(jobToSummarize));
            prompt_instruction = prompt_instruction.replace('{#log_entries}', JSON.serialize(logEntries));
            
            String prompt = '';
            prompt += customized_prompt + prompt_instruction;
            System.debug('prompt : '+ prompt);

            String generateConfig = ai_defaults.Job_Summary_generationConfig__c ?? '{"responseMimeType":"application/json","responseSchema":{"type":"object","properties":{"ReportMetaData":{"type":"object","properties":{"ReportDate":{"type":"string"}},"required":["ReportDate"]},"JobOverview":{"type":"object","properties":{"JobName":{"type":"string"},"JobNumber":{"type":"string"},"Status":{"type":"string"},"Location":{"type":"string"},"StartDate":{"type":"string"},"EstimatedEndDate":{"type":"string"},"ContractPrice":{"type":"string"},"TotalManHoursLogged":{"type":"string"},"TotalContractValue":{"type":"string"},"ChangeOrderValue":{"type":"string"},"Mobilizations":{"type":"integer"}},"required":["JobName","Status","Location","ContractPrice","TotalManHoursLogged","Mobilizations"]},"ShiftLogSummary":{"type":"object","properties":{"EachLogSummary":{"type":"array","description":"Daily summary of key work activities such as work performed, exception and other information. if there is multiple log for the same day, merge into one day.","items":{"type":"object","properties":{"Date":{"type":"string"},"SummaryOfKeyWorkActivities":{"type":"string","description":"Daily summary of key work performed."},"ExceptionCause":{"type":"string","description":"Specific exceptions/challenges logged by date."}},"required":["Date","SummaryOfKeyWorkActivities","ExceptionCause"]}},"WorkPerformedOverallSummary":{"type":"string","description":"Narrative summarizing the scope and status of work performed."},"ExceptionOverallSummary":{"type":"string","description":"Narrative summarizing the impact of the exceptions."}},"required":["EachLogSummary","ExceptionOverallSummary","WorkPerformedOverallSummary"]},"NotesForOffice":{"type":"array","description":"Action items or suggestions for management/office staff.","items":{"type":"string"}},"OverallJobHealthSummary":{"type":"object","properties":{"Progress":{"type":"string","description":"Progress of the overall job in minimal word"},"RiskLevel":{"type":"string","description":"Risk Level"},"Efficiency":{"type":"string","description":"Efficiency of the job in  minimal word"},"ResourceUtilization":{"type":"string","description":"Resource utilization throughout the job in  minimal word"},"Status":{"type":"string","description":"Status of the job in  minimal word"}},"required":["Progress","Efficiency","ResourceUtilization","Status"]},"FinalSummary":{"type":"string","description":"The concluding statement on the project\'s health and outlook."},"Label":{ "type": "object", "description": "Contains all UI labels translated into the selected language while keeping original meaning and context.", "properties": { "JobOverviewTitle": { "type": "string", "description": "Label for \'Job Overview\' section title." }, "JobName": { "type": "string", "description": "Label for \'Job Name\'." }, "Status": { "type": "string", "description": "Label for \'Status\'." }, "Location": { "type": "string", "description": "Label for \'Location\'." }, "ContractPrice": { "type": "string", "description": "Label for \'Contract Price\'." }, "TotalManHoursLogged": { "type": "string", "description": "Label for \'Total Man Hours Logged\'." }, "TotalContractValue": { "type": "string", "description": "Label for \'Total Contract Value\'." }, "Mobilizations": { "type": "string", "description": "Label for \'Mobilizations\'." }, "WorkProgressSummaryTitle": { "type": "string", "description": "Label for \'Work Progress Summary (By Each Day)\' section title." }, "GroupedByWorkDates": { "type": "string", "description": "Label for \'Grouped by Work Dates:\'." }, "Date": { "type": "string", "description": "Label for \'Date\' column." }, "SummaryOfKeyWorkActivities": { "type": "string", "description": "Label for \'Summary of Key Work Activities\'." }, "OverallWorkSummary": { "type": "string", "description": "Label for \'Overall Summary\'." }, "ExceptionsChallengesTitle": { "type": "string", "description": "Label for \'Exceptions / Challenges\' section title." }, "ExceptionCause": { "type": "string", "description": "Label for \'Exception / Cause\' column." }, "ExceptionOverallSummary": { "type": "string", "description": "Label for \'Summary\' under exceptions." }, "NotesForOfficeTitle": { "type": "string", "description": "Label for \'Notes for Office\' section title." }, "OverallJobHealthSummaryTitle": { "type": "string", "description": "Label for \'Overall Job Health Summary\' section title." }, "ScheduleProgress": { "type": "string", "description": "Label for \'Schedule Progress\'." }, "CommunicationEfficiency": { "type": "string", "description": "Label for \'Communication Efficiency\'." }, "ResourceUtilization": { "type": "string", "description": "Label for \'Resource Utilization\'." }, "DocumentationStatus": { "type": "string", "description": "Label for \'Documentation Status\'." }, "FinalSummaryTitle": { "type": "string", "description": "Label for \'Final Summary\' section title." }, "ReportDate": { "type": "string", "description": "Label for \'Report Date\' at top of page." } }, "required": [ "JobOverviewTitle", "JobName", "Status", "Location", "ContractPrice", "TotalManHoursLogged", "TotalContractValue", "Mobilizations", "WorkProgressSummaryTitle", "GroupedByWorkDates", "Date", "SummaryOfKeyWorkActivities", "OverallWorkSummary", "ExceptionsChallengesTitle", "ExceptionCause", "ExceptionOverallSummary", "NotesForOfficeTitle", "OverallJobHealthSummaryTitle", "ScheduleProgress", "CommunicationEfficiency", "ResourceUtilization", "DocumentationStatus", "FinalSummaryTitle", "ReportDate" ]}},"required":["JobOverview","ShiftLogSummary","NotesForOffice","OverallJobHealthSummary","FinalSummary"]}}';

            String requestBody = '{' + 
                '"contents": [' + 
                    '{' + 
                        '"parts": [' + 
                            '{"text": ' + JSON.serialize(prompt) + '}' +
                        ']' + 
                    '}' + 
                '],' + 
                '"generationConfig": ' + String.escapeSingleQuotes(generateConfig) +
            '}';

            result = callGeminiAPI(requestBody);
            String aiResponse = (String) result.get('ai_Response__c');

            if(String.isBlank(aiResponse)) return result;

            if(avoidHtmlContent == true) return result;

            // prepare HTML content or store temporary record to fetch HTML content later
            result.putAll(prepareForHtmlContent(result, aiResponse, jobId));

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'AICalloutController', 'methodName' => 'generateJobSummary', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('ai_Response_Error__c', 'Error : Failed in generateJobSummary ' + e.getMessage());
        }
        return result;
    }

    public static Map<string, object> prepareForHtmlContent(Map<string, object> result, String aiResponse, String jobId){

        FR_Job_AI_Settings__c aiSettings = FR_Job_AI_Settings__c.getOrgDefaults();
        String htmlContentVfPage = aiSettings.HTML_Content_VF_Page__c;
        if(String.isBlank(htmlContentVfPage)){
            result.put('error', 'Error : HTML Content VF Page is not configured in AI Settings');
            return result;
        }

        // prepare VF page URL to render HTML content
        String vfURL = Site.getBaseUrl() + '/apex/'+htmlContentVfPage+'?summary='+EncodingUtil.urlEncode(aiResponse,'UTF-8');
        if(vfURL.length() < 4000) {
            // Render the page only if URL length is within limits(4096)
            Blob htmlContentBlob = new PageReference(vfURL).getContent();
            result.put('htmlContent', htmlContentBlob.toString());
            System.debug('htmlContent : '+ htmlContentBlob.toString());
        }
        else{
            // Otherwise...
            // Store the summary data in a temporary Job_Summary_AI__c record
            // Send job Summary Id to LWC to fetch HTML content in next call
            Job_Summary_AI__c jsa = new Job_Summary_AI__c();
            jsa.Job__c = jobId;
            jsa.Summary_Data_Raw__c = aiResponse;
            jsa.Is_Temporary__c = true;
            insert as user jsa;
            result.put('jobSummaryId', jsa.Id);
        }

        return result;
    }

    /**
     * @description This method is used to generate job summary
     * @param String inputData
     * 
     * @return Map<String, Object>
     * 1. key: ai_Response__c, value: String
     * 2. key: ai_Response_Error__c, value: String
     * 
     */
    public static Map<String,Object> callGeminiAPI(String requestBody) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            
            FR_Job_AI_Settings__c aiSettings = FR_Job_AI_Settings__c.getOrgDefaults();
            String Gemini_API_Domain = aiSettings.Gemini_API_Domain__c;
            String Gemini_API_Relative_Path = aiSettings.Gemini_API_Relative_Path__c;
            String Gemini_API_Key = aiSettings.Gemini_API_Key__c;
            String Gemini_Model = aiSettings.Gemini_Model__c;

            String endpoint = Gemini_API_Domain + Gemini_API_Relative_Path + Gemini_Model + ':generateContent?key=' + Gemini_API_Key;

            // Prepare request
            HttpRequest req = new HttpRequest();
            req.setEndpoint(endpoint);
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');

            req.setBody(requestBody);
            req.setTimeout(120000);

            System.debug('requestBody : '+requestBody);

            if(Gemini_Model == 'gemini-2.5-flash'){
                Map<String, Object> generationConfig = new Map<String, Object>();
                Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(requestBody);
                if (body.containsKey('generationConfig')) {
                    generationConfig = (Map<String, Object>) body.get('generationConfig');
                }
                else{
                    body.put('generationConfig', generationConfig);
                }
                generationConfig.put('thinkingConfig', '{ "includeThoughts": false,"thinkingBudget": 0, }');
                requestBody = JSON.serialize(body);
                System.debug('requestBody after adding  thinkingBudget : '+requestBody);
            }

            
            Http http = new Http();
            HttpResponse res = http.send(req);

            System.debug('Gemini API Response: ' + res.getBody());

            GeminiResponseWrapper response = (GeminiResponseWrapper) JSON.deserialize(res.getBody(), GeminiResponseWrapper.class);
            System.debug('GeminiResponseWrapper : '+ response);

            if (res.getStatusCode() == 200) {
                if(response?.candidates?.size() > 0 && response.candidates[0]?.content?.parts?.size() > 0) {
                    String responseText = response.candidates[0].content.parts[0]?.text;
                    result.put('ai_Response__c', responseText);
                }
                else{
                    result.put('ai_Response_Error__c', 'Error: No Response Found');
                }
            } else {
                System.debug('Gemini API Error - Status: ' + res.getStatusCode() + ', Body: ' + res.getBody());
                result.put('ai_Response_Error__c', 'Error: Response Error. ');
            }
        } catch (Exception e) {
            System.debug('Error in callGeminiAPI: ' + e.getMessage() + ' at line ' + e.getLineNumber());
            result.put('ai_Response_Error__c', 'Error : Failed to get response from Gemini API. ' + e.getMessage());
        }
        return result;
    }

    public static Integer weekDay(){
        return Date.today().toStartOfWeek().daysBetween(Date.today()) + 1;
    }
    
    public class RequestInput {
        @AuraEnabled public String jobId;
        @AuraEnabled public String startDate;
        @AuraEnabled public String endDate;
        @AuraEnabled public String language;
        @AuraEnabled public String durationType;
        @AuraEnabled public String workVisibility;
        @AuraEnabled public List<String> crews;
        @AuraEnabled public Boolean avoidHtmlContent;
        @AuraEnabled public String promptId;
    }
}