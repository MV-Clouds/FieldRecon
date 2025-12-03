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
            result.put('error', 'Error : Failed in getUserDesignation ' + e.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static Map<String, Object> generateRecordingSummary(Map<String, Object> audioData) {
        Map<String, Object> result = new Map<String, Object>();
        try {

            // String audio = (String) String.valueOf(audioData.get('audio'));
            String transcript_en = (String) String.valueOf(audioData.get('transcript_en'));
            
            String userPrompt = ''+
            'Here is Shift Log Detail: '+transcript_en+
            'Detail contains work log information about each crew member.'+
            // 'I will provide work Shift Log entry detail. i will provide information about what crew has been done over the working shift or whole day'+
            // 'I will provide work Shift Log entry detail in audio form. i will provide information about what me and my crew has been done over the working shift or whole day'+
            // 'Please Provide the Transcript for the following audio in the language it has been spoken.'+
            // 'Provide language and its code. Translate the Transcript it into english. '+
            // 'Please consider '+UserInfo.getName()+' as me. And Summarize the detail based on what work has been done by each person.'+
            'Provide Some Detailed information about the work had been done on shift based on detail.'+
            'If there is no Information About Work Detail add No Job Detail In no_valid_entry key, otherwise skip it'+
            'Only Provide Response In Mentioned Format/Structure '+
            'Thank you for your assistance';

            // Map<String, Object> data = new Map<String, Object>();
            // data.put('mime_type', 'audio/webm');
            // data.put('data', audio);
            // String prompt = JSON.serialize(data);
            // System.debug('prompt : '+prompt);

            // Build full request body using content structure
            String requestBody = '{' + 
                '"contents": [' + 
                    '{' + 
                        '"parts": [' + 
                            '{"text": "' + userPrompt + '"}' +
                            // '{"inline_data": ' + prompt + '}' +
                        ']' + 
                    '}' + 
                '],' + 
                '"generationConfig": {' + 
                    '"responseMimeType": "application/json",' + 
                    '"responseJsonSchema": {' + 
                        '"type": "object",' + 
                        '"properties": {' + 
                            // '"language": {' + 
                            //     '"type": "string",' + 
                            //     '"description": "The language detected in the input audio/text."' + 
                            // '},' + 
                            // '"lang_code": {' + 
                            //     '"type": "string",' + 
                            //     '"description": "The ISO 639-1 language code (e.g., \'en\', \'hi\', \'fr\')."' + 
                            // '},' + 
                            // '"transcript": {' + 
                            //     '"type": "string",' + 
                            //     '"description": "The full verbatim transcript of the speech."' + 
                            // '},' + 
                            // '"translation_en": {' + 
                            //     '"type": "string",' + 
                            //     '"description": "An English translation of the full transcript."' + 
                            // '},' + 
                            '"info": {' + 
                                '"type": "string",' + 
                                '"description": "General summary or context of the input."' + 
                            '},' + 
                            '"whatWeDone": {' + 
                                '"type": "string",' + 
                                '"description": "Summary (about 50 or more words) work completed by me or my crew today or in the specified period, including specific achievements and key results. Keep me and my crew as subject."' + 
                            '},' + 
                            '"planForTomorrow": {' + 
                                '"type": "string",' + 
                                '"description": "A detailed plan (about 50 or more words) for the next day, including prioritized tasks, required resources, and anticipated outcomes."' + 
                            '},' + 
                            '"notesToOffice": {' + 
                                '"type": "string",' + 
                                '"description": "Any specific notes, requests, or messages to be communicated to the office or management (e.g., supplies needed, meeting requests). If no information available then leave this blank"' + 
                            '},' + 
                            '"exceptions": {' + 
                                '"type": "string",' + 
                                '"description": "Any issues, blockers, or unusual circumstances encountered. If no information available then leave this blank"' + 
                            '},' + 
                            '"no_valid_entry": {' + 
                                '"type": "boolean",' + 
                                '"description": "Set to true if the input did not contain valid or relevant information for the other fields, otherwise false."' + 
                            '}' + 
                        '},' + 
                        // '"required": [ "language", "lang_code", "transcript", "translation_en", "info", "whatWeDone", "planForTomorrow", "notesToOffice", "exceptions", "no_valid_entry" ]' + 
                        '"required": [ "info", "whatWeDone", "planForTomorrow", "notesToOffice", "exceptions", "no_valid_entry" ]' + 
                    '}' + 
                '}' + 
            '}';

            result = callGeminiAPI(requestBody);
            // result = {'ai_Response__c' : 'summary'}
            
        } catch (Exception e) {
            result.put('ai_Response_Error__c', 'Error : Failed in generateRecordingSummary ' + e.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static Map<String, Object> generateSingleRecordingTranscript(Map<String, Object> audioData) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            String audio = (String) String.valueOf(audioData.get('audio'));
            
            String userPrompt = ''+
            'I will provide work Shift Log entry detail in audio form. Audio has information about what work has been done over the working shift or whole day'+
            'Please Provide the Transcript for the following audio in the language it has been spoken.'+
            'Provide language and its code. Translate the Transcript it into english. '+
            'If there is no Information About Work Detail add No Job Detail In no_valid_entry key, otherwise skip it'+
            'Only Provide Response In Mentioned Format/Structure '+
            'Note: Always provide JSON within (even if no detail is available) the response as i need parsing JSON.'+
            'Thank you for your assistance';

            Map<String, Object> data = new Map<String, Object>();
            data.put('mime_type', 'audio/webm');
            data.put('data', audio);
            String prompt = JSON.serialize(data);
            System.debug('prompt : '+prompt);

            // Build full request body using content structure
            String requestBody = '{' + 
                '"contents": [' + 
                    '{' + 
                        '"parts": [' + 
                            '{"text": "' + userPrompt + '"},' +
                            '{"inline_data": ' + prompt + '}' +
                        ']' + 
                    '}' + 
                '],' + 
                '"generationConfig": {' + 
                    '"responseMimeType": "application/json",' + 
                    '"responseJsonSchema": {' + 
                        '"type": "object",' + 
                        '"properties": {' + 
                            '"language": {' + 
                                '"type": "string",' + 
                                '"description": "The language detected in the input audio/text."' + 
                            '},' + 
                            '"lang_code": {' + 
                                '"type": "string",' + 
                                '"description": "The ISO 639-1 language code (e.g., \'en\', \'hi\', \'fr\')."' + 
                            '},' + 
                            '"transcript": {' + 
                                '"type": "string",' + 
                                '"description": "The full verbatim transcript of the speech."' + 
                            '},' + 
                            '"translation_en": {' + 
                                '"type": "string",' + 
                                '"description": "An English translation of the full transcript."' + 
                            '},' + 
                            '"no_valid_entry": {' + 
                                '"type": "boolean",' + 
                                '"description": "Set to true if the input did not contain valid or relevant information for the other fields, otherwise false."' + 
                            '}' + 
                        '},' + 
                        '"required": [ "language", "lang_code", "transcript", "translation_en", "no_valid_entry" ]' + 
                    '}' + 
                '}' + 
            '}';

            result = callGeminiAPI(requestBody);
            // result = {'ai_Response__c' : 'summary'}
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'AICalloutController', 'methodName' => 'generateSingleRecordingTranscript', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            result.put('ai_Response_Error__c', 'Error : Failed in generateRecordingSummary ' + e.getMessage());
        }
        return result;
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
    }

    public static string generateConfig = ''+
    '{"responseMimeType":"application/json","responseSchema":{"type":"object","properties":{"ReportMetaData":{"type":"object","properties":{"ReportDate":{"type":"string"}},"required":["ReportDate"]},"JobOverview":{"type":"object","properties":{"JobName":{"type":"string"},"JobNumber":{"type":"string"},"Status":{"type":"string"},"Location":{"type":"string"},"StartDate":{"type":"string"},"EstimatedEndDate":{"type":"string"},"ContractPrice":{"type":"string"},"TotalManHoursLogged":{"type":"string"},"TotalContractValue":{"type":"string"},"ChangeOrderValue":{"type":"string"},"Mobilizations":{"type":"integer"}},"required":["JobName","Status","Location","ContractPrice","TotalManHoursLogged","Mobilizations"]},"ShiftLogSummary":{"type":"object","properties":{"EachLogSummary":{"type":"array","description":"Daily summary of key work activities such as work performed, exception and other information. if there is multiple log for the same day, merge into one day.","items":{"type":"object","properties":{"Date":{"type":"string"},"SummaryOfKeyWorkActivities":{"type":"string","description":"Daily summary of key work performed."},"ExceptionCause":{"type":"string","description":"Specific exceptions/challenges logged by date."}},"required":["Date","SummaryOfKeyWorkActivities","ExceptionCause"]}},"WorkPerformedOverallSummary":{"type":"string","description":"Narrative summarizing the scope and status of work performed."},"ExceptionOverallSummary":{"type":"string","description":"Narrative summarizing the impact of the exceptions."}},"required":["EachLogSummary","ExceptionOverallSummary","WorkPerformedOverallSummary"]},"NotesForOffice":{"type":"array","description":"Action items or suggestions for management/office staff.","items":{"type":"string"}},"OverallJobHealthSummary":{"type":"object","properties":{"Progress":{"type":"string","description":"Progress of the overall job in minimal word"},"RiskLevel":{"type":"string","description":"Risk Level"},"Efficiency":{"type":"string","description":"Efficiency of the job in  minimal word"},"ResourceUtilization":{"type":"string","description":"Resource utilization throughout the job in  minimal word"},"Status":{"type":"string","description":"Status of the job in  minimal word"}},"required":["Progress","Efficiency","ResourceUtilization","Status"]},"FinalSummary":{"type":"string","description":"The concluding statement on the project\'s health and outlook."},"Label":{ "type": "object", "description": "Contains all UI labels translated into the selected language while keeping original meaning and context.", "properties": { "JobOverviewTitle": { "type": "string", "description": "Label for \'Job Overview\' section title." }, "JobName": { "type": "string", "description": "Label for \'Job Name\'." }, "Status": { "type": "string", "description": "Label for \'Status\'." }, "Location": { "type": "string", "description": "Label for \'Location\'." }, "ContractPrice": { "type": "string", "description": "Label for \'Contract Price\'." }, "TotalManHoursLogged": { "type": "string", "description": "Label for \'Total Man Hours Logged\'." }, "TotalContractValue": { "type": "string", "description": "Label for \'Total Contract Value\'." }, "Mobilizations": { "type": "string", "description": "Label for \'Mobilizations\'." }, "WorkProgressSummaryTitle": { "type": "string", "description": "Label for \'Work Progress Summary (By Each Day)\' section title." }, "GroupedByWorkDates": { "type": "string", "description": "Label for \'Grouped by Work Dates:\'." }, "Date": { "type": "string", "description": "Label for \'Date\' column." }, "SummaryOfKeyWorkActivities": { "type": "string", "description": "Label for \'Summary of Key Work Activities\'." }, "OverallWorkSummary": { "type": "string", "description": "Label for \'Overall Summary\'." }, "ExceptionsChallengesTitle": { "type": "string", "description": "Label for \'Exceptions / Challenges\' section title." }, "ExceptionCause": { "type": "string", "description": "Label for \'Exception / Cause\' column." }, "ExceptionOverallSummary": { "type": "string", "description": "Label for \'Summary\' under exceptions." }, "NotesForOfficeTitle": { "type": "string", "description": "Label for \'Notes for Office\' section title." }, "OverallJobHealthSummaryTitle": { "type": "string", "description": "Label for \'Overall Job Health Summary\' section title." }, "ScheduleProgress": { "type": "string", "description": "Label for \'Schedule Progress\'." }, "CommunicationEfficiency": { "type": "string", "description": "Label for \'Communication Efficiency\'." }, "ResourceUtilization": { "type": "string", "description": "Label for \'Resource Utilization\'." }, "DocumentationStatus": { "type": "string", "description": "Label for \'Documentation Status\'." }, "FinalSummaryTitle": { "type": "string", "description": "Label for \'Final Summary\' section title." }, "ReportDate": { "type": "string", "description": "Label for \'Report Date\' at top of page." } }, "required": [ "JobOverviewTitle", "JobName", "Status", "Location", "ContractPrice", "TotalManHoursLogged", "TotalContractValue", "Mobilizations", "WorkProgressSummaryTitle", "GroupedByWorkDates", "Date", "SummaryOfKeyWorkActivities", "OverallWorkSummary", "ExceptionsChallengesTitle", "ExceptionCause", "ExceptionOverallSummary", "NotesForOfficeTitle", "OverallJobHealthSummaryTitle", "ScheduleProgress", "CommunicationEfficiency", "ResourceUtilization", "DocumentationStatus", "FinalSummaryTitle", "ReportDate" ]}},"required":["JobOverview","ShiftLogSummary","NotesForOffice","OverallJobHealthSummary","FinalSummary"]}}'+
    '';

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

            List<AI_Prompt_Library__c> promptList = [SELECT Id, Name, Prompt_Type__c, Prompt_Body__c FROM AI_Prompt_Library__c WHERE Prompt_Type__c = 'Job Summary' LIMIT 1];
            String userPrompt = promptList?.size() > 0 ? promptList[0].Prompt_Body__c : 'Summarize the job and its shift log entries.';

            String prompt = '';
            prompt += userPrompt +
            // 'Summarize and  Also the response must be in the language with following language code: ' + 
            ' Carefully comprehend the above message and strictly give response based on Job and its shift log entries in the "expected format" even if no log entries is present. '+
            'Response Detail Must be in following language: '+language+'. '+
            'Here is Detail of Job Record:' + JSON.serialize(jobToSummarize) + ' and  Daily logs:' + JSON.serialize(logEntries) + 
            '';
            
            System.debug('prompt : '+ prompt);

            String requestBody = prepareRequestBody(prompt, generateConfig);

            result = callGeminiAPI(requestBody);
            String aiResponse = (String) result.get('ai_Response__c');

            if(String.isBlank(aiResponse)) return result;

            if(avoidHtmlContent == true) return result;

            // prepare HTML content or store temporary record to fetch HTML content later
            result.putAll(prepareForHtmlContent(result, aiResponse, jobId));

        } catch (Exception e) {
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
            result.put('error', 'Error : Failed in generateJobSummary ' + e.getMessage());
        }
        return result;
        
    }

    public static string prepareRequestBody(String prompt,String generateConfig){
        try {
            // Build full request body using content structure
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

            return requestBody;
        } catch (Exception e) {
            System.debug('Error in preparePrompt: ' + e.getMessage() + ' at line ' + e.getLineNumber());
            return '';
        }
    }

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

            Http http = new Http();
            HttpResponse res = http.send(req);

            System.debug('Gemini API Response: ' + res.getBody());

            if (res.getStatusCode() == 200) {
                Map<String, Object> resMap = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                if (resMap.containsKey('candidates')) {
                    List<Object> candidates = (List<Object>) resMap.get('candidates');
                    if (!candidates.isEmpty()) {
                        Map<String, Object> firstCandidate = (Map<String, Object>) candidates[0];
                        if (firstCandidate.containsKey('content')) {
                            Map<String, Object> content = (Map<String, Object>) firstCandidate.get('content');
                            if (content.containsKey('parts')) {
                                List<Object> parts = (List<Object>) content.get('parts');
                                if (!parts.isEmpty()) {
                                    Map<String, Object> firstPart = (Map<String, Object>) parts[0];
                                    result.put('ai_Response__c', (String) firstPart.get('text'));
                                    return result;
                                }
                            }
                        }
                    }
                }
            } else {
                System.debug('Gemini API Error - Status: ' + res.getStatusCode() + ', Body: ' + res.getBody());
                result.put('ai_Response_Error__c', 'Error : Response Error. ');
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
}