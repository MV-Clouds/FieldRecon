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

public class AICalloutController {
    @AuraEnabled
    public static Map<String, Object> generateRecordingSummary(String audioData) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            
            String userPrompt = 'I will provide work Shift Log entry detail in audio form. i will provide information about what me and my crew has been done over the working shift or whole day'+
                'Please Provide the Transcript for the following audio in the language it has been spoken.'+
                'Provide language and its code. Translate the Transcript it into english. '+
                'Provide Some Detailed information about the work had been done on shift based on audion transcript.'+
                'If there is no Information About Work Detail add No Job Detail In no_valid_entry key, otherwise skip it'+
                'Only Provide Response In Mentioned Format/Structure '+
                'Note: Always provide JSON within (even if no audio is available) the response as i am parsing JSON.'+
                'Thank you for your assistance';

            Map<String, Object> data = new Map<String, Object>();
            data.put('mime_type', 'audio/webm');
            data.put('data', audioData);
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
                        '"required": [ "language", "lang_code", "transcript", "translation_en", "info", "whatWeDone", "planForTomorrow", "notesToOffice", "exceptions", "no_valid_entry" ]' + 
                    '}' + 
                '}' + 
            '}';

            result = callGeminiAPI(requestBody);
            
        } catch (Exception e) {
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
    }

    public static string generateConfig = ''+
    '{"responseMimeType":"application/json","responseSchema":{"type":"object","properties":{"ReportMetaData":{"type":"object","properties":{"ReportDate":{"type":"string"}},"required":["ReportDate"]},"JobOverview":{"type":"object","properties":{"JobName":{"type":"string"},"JobNumber":{"type":"string"},"Status":{"type":"string"},"Location":{"type":"string"},"StartDate":{"type":"string"},"EstimatedEndDate":{"type":"string"},"ContractPrice":{"type":"string"},"TotalManHoursLogged":{"type":"string"},"TotalContractValue":{"type":"string"},"ChangeOrderValue":{"type":"string"},"Mobilizations":{"type":"integer"}},"required":["JobName","Status","Location","ContractPrice","TotalManHoursLogged","Mobilizations"]},"ShiftLogSummary":{"type":"object","properties":{"EachLogSummary":{"type":"array","description":"Daily summary of key work activities such as work performed, exception and other information. if there is multiple log for the same day, merge into one day.","items":{"type":"object","properties":{"Date":{"type":"string"},"SummaryOfKeyWorkActivities":{"type":"string","description":"Daily summary of key work performed."},"ExceptionCause":{"type":"string","description":"Specific exceptions/challenges logged by date."}},"required":["Date","SummaryOfKeyWorkActivities","ExceptionCause"]}},"WorkPerformedOverallSummary":{"type":"string","description":"Narrative summarizing the scope and status of work performed."},"ExceptionOverallSummary":{"type":"string","description":"Narrative summarizing the impact of the exceptions."}},"required":["EachLogSummary","ExceptionOverallSummary","WorkPerformedOverallSummary"]},"NotesForOffice":{"type":"array","description":"Action items or suggestions for management/office staff.","items":{"type":"string"}},"OverallJobHealthSummary":{"type":"object","properties":{"Progress":{"type":"string","description":"Progress of the overall job in minimal word"},"RiskLevel":{"type":"string","description":"Risk Level"},"Efficiency":{"type":"string","description":"Efficiency of the job in  minimal word"},"ResourceUtilization":{"type":"string","description":"Resource utilization throughout the job in  minimal word"},"Status":{"type":"string","description":"Status of the job in  minimal word"}},"required":["Progress","Efficiency","ResourceUtilization","Status"]},"FinalSummary":{"type":"string","description":"The concluding statement on the project\'s health and outlook."},"Label":{ "type": "object", "description": "Contains all UI labels translated into the selected language while keeping original meaning and context.", "properties": { "JobOverviewTitle": { "type": "string", "description": "Label for \'Job Overview\' section title." }, "JobName": { "type": "string", "description": "Label for \'Job Name\'." }, "Status": { "type": "string", "description": "Label for \'Status\'." }, "Location": { "type": "string", "description": "Label for \'Location\'." }, "ContractPrice": { "type": "string", "description": "Label for \'Contract Price\'." }, "TotalManHoursLogged": { "type": "string", "description": "Label for \'Total Man Hours Logged\'." }, "TotalContractValue": { "type": "string", "description": "Label for \'Total Contract Value\'." }, "Mobilizations": { "type": "string", "description": "Label for \'Mobilizations\'." }, "WorkProgressSummaryTitle": { "type": "string", "description": "Label for \'Work Progress Summary (By Each Day)\' section title." }, "GroupedByWorkDates": { "type": "string", "description": "Label for \'Grouped by Work Dates:\'." }, "Date": { "type": "string", "description": "Label for \'Date\' column." }, "SummaryOfKeyWorkActivities": { "type": "string", "description": "Label for \'Summary of Key Work Activities\'." }, "OverallWorkSummary": { "type": "string", "description": "Label for \'Overall Summary\'." }, "ExceptionsChallengesTitle": { "type": "string", "description": "Label for \'Exceptions / Challenges\' section title." }, "ExceptionCause": { "type": "string", "description": "Label for \'Exception / Cause\' column." }, "ExceptionOverallSummary": { "type": "string", "description": "Label for \'Summary\' under exceptions." }, "NotesForOfficeTitle": { "type": "string", "description": "Label for \'Notes for Office\' section title." }, "OverallJobHealthSummaryTitle": { "type": "string", "description": "Label for \'Overall Job Health Summary\' section title." }, "ScheduleProgress": { "type": "string", "description": "Label for \'Schedule Progress\'." }, "CommunicationEfficiency": { "type": "string", "description": "Label for \'Communication Efficiency\'." }, "ResourceUtilization": { "type": "string", "description": "Label for \'Resource Utilization\'." }, "DocumentationStatus": { "type": "string", "description": "Label for \'Documentation Status\'." }, "FinalSummaryTitle": { "type": "string", "description": "Label for \'Final Summary\' section title." }, "ReportDate": { "type": "string", "description": "Label for \'Report Date\' at top of page." } }, "required": [ "JobOverviewTitle", "JobName", "Status", "Location", "ContractPrice", "TotalManHoursLogged", "TotalContractValue", "Mobilizations", "WorkProgressSummaryTitle", "GroupedByWorkDates", "Date", "SummaryOfKeyWorkActivities", "OverallWorkSummary", "ExceptionsChallengesTitle", "ExceptionCause", "ExceptionOverallSummary", "NotesForOfficeTitle", "OverallJobHealthSummaryTitle", "ScheduleProgress", "CommunicationEfficiency", "ResourceUtilization", "DocumentationStatus", "FinalSummaryTitle", "ReportDate" ]}},"required":["JobOverview","ShiftLogSummary","NotesForOffice","OverallJobHealthSummary","FinalSummary"]}}'+
    '';

    @AuraEnabled
    public static Map<String,Object> generateJobSummary(String inputData) {
        Map<String,Object> result = new Map<String,Object>();
        try {
            
            System.debug('input : '+ inputData);
            RequestInput input = (RequestInput)JSON.deserialize(inputData, RequestInput.class);
            String jobId = input.jobId;
            String startDate = input.startDate;
            String endDate = input.endDate;
            String language = input.language ?? 'English';
            String durationType = input.durationType ?? 'all';
            

            String whereClause = ' WHERE wfrecon__Job__c = :jobId ';
            
            // Validate required inputs
            // if (String.isBlank(recordId) || String.isBlank(startDate) || String.isBlank(endDate)) {
            //     return 'Please provide all required inputs.';
            // }
            
            if(durationType == 'custom_Duration'){
                // Convert string inputs to Date
                Date startDt = Date.valueOf(startDate);
                Date endDt   = Date.valueOf(endDate);
                whereClause += 'AND (wfrecon__Work_Performed_Date__c >= :startDt AND wfrecon__Work_Performed_Date__c <= :endDt)';
            }else if(durationType == 'this_Week'){
                whereClause += 'AND wfrecon__Date__c >= LAST_N_DAYS:7';
            }


            // Need To Review Start
            wfrecon__Job__c jobToSummarize = [SELECT Id, Name, CreatedDate, LastModifiedDate, wfrecon__Account__c, wfrecon__Actual_Man_Hours__c, wfrecon__Architect__c, wfrecon__City__c, wfrecon__Click_for_Map__c, wfrecon__Complete__c, wfrecon__Completion_Date__c, wfrecon__Contract_Date__c, wfrecon__Country__c, wfrecon__County__c, wfrecon__Description__c, wfrecon__FIPS_County__c, wfrecon__FIPS_State__c, wfrecon__Geocode__Latitude__s, wfrecon__Geocode__Longitude__s, wfrecon__Geocode__c, wfrecon__Job_Address__c, wfrecon__Job_Name__c, wfrecon__Job_Number__c, wfrecon__Need_Hotels__c, wfrecon__Parent_Job__c, wfrecon__Per_Diem__c, wfrecon__QB_Customer_Id__c, wfrecon__Retainage__c, wfrecon__State__c, wfrecon__Status__c, wfrecon__Street__c, wfrecon__Sync_Token__c, wfrecon__Title__c, wfrecon__Total_Budgeted_Man_Hours__c, wfrecon__Total_Budgeted_Material_Cost__c, wfrecon__Total_Contract_Price__c, wfrecon__Total_Job_Material_Expense__c, wfrecon__Value_of_Current_Completed_Work__c, wfrecon__Zip_Code__c, wfrecon__End_Date_Rollup__c, wfrecon__Mobilization_Count__c, wfrecon__Start_Date_Rollup__c, wfrecon__Total_Change_Order_Value__c, wfrecon__Total_Contract_Value__c, wfrecon__Address__c, wfrecon__Client_Name__c, wfrecon__Job_Link__c, wfrecon__Remaining_Budgeted_Man_Hours__c, wfrecon__Remaining_Budgeted_Material_Cost__c, wfrecon__Status_Light__c, wfrecon__Total_Man_Hours__c FROM wfrecon__Job__c WHERE Id = :jobId ];
            
            List<wfrecon__Log_Entry__c> logEntries = Database.query('SELECT Name, wfrecon__Approval_Data__c, wfrecon__Approved_Date__c, wfrecon__Exceptions__c, wfrecon__Log_Type__c, wfrecon__Material_Usage_Complete__c, wfrecon__Notes_to_Office__c, wfrecon__Plan_for_Tomorrow__c, wfrecon__Processes_Updated__c, wfrecon__Status__c, wfrecon__Time_Entries_Complete__c, wfrecon__Travel_Log_Complete__c, wfrecon__Work_Performed__c, wfrecon__Work_Performed_Date__c FROM wfrecon__Log_Entry__c' + whereClause);
            System.debug('logEntries : '+ logEntries);
            // String prompt = 'You will receive a job record and optionally a list of daily log entries. Your task is to generate a professional, visually consistent HTML summary report that is fully self-contained with inline styles only and spans the full width of the page. VERY IMPORTANT: - The response must contain only HTML markup. - All styling must be inline using the style attribute; no external CSS or classes. - The entire report must use 100% width with no fixed-width containers. - Each section and daily log entry must use consistent fixed styling. - All content must be summarized and rewritten in your own words; do not copy text verbatim. - The report must be written in the following language:' + language + ' . REPORT STRUCTURE AND STYLE REQUIREMENTS: 1. JOB DETAILS   - Do NOT include job name or job number.   - Include the following fields in <p> tags (font-size: 16px; margin: 5px 0):     Start Date, End Date, Total Mobilizations, Total Man Hours, Location.   - Add a Job Description <p> summarizing the overall scope and purpose (font-size: 16px; line-height: 1.6).   - If team members or stakeholders exist, list them in a <ul> (font-size: 16px; padding-left: 20px). 2. DAILY LOGS   - Add a <h2> with: color: #2a7ae2; font-size: 24px; margin-bottom: 15px.   - If log entries exist:     Each log entry must be wrapped in a <div> with the following inline styles:       - background-color: #ffffff       - border-left: 5px solid #2a7ae2       - padding: 20px       - margin-bottom: 20px       - border-radius: 8px       - box-shadow: 0 1px 4px rgba(0,0,0,0.1)       - width: 100%       - box-sizing: border-box     Include:       - <h3> for date (color: #1f4e79; font-size: 20px; margin-top: 0)       - Several <p> elements with bold labels:           • <strong>Work Performed:</strong> summarized description           • <strong>Challenges / Issues:</strong> summarized obstacles           • <strong>Resources Used:</strong> machinery, materials, manpower summary           • <strong>Discussions / Approvals:</strong> approvals or decisions           • <strong>Plan for Tomorrow:</strong> next-day plan   - If NO log entries exist:     Display a single <p> with inline styles:       font-size: 16px; margin: 10px 0; color: #555555;       background-color: #f8f8f8; padding: 15px;       border-radius: 6px; width: 100%; box-sizing: border-box;     Text: No log entries available for this job period. 3. OVERALL SUMMARY   - Add a <h2> with: color: #2a7ae2; font-size: 24px.   - Include a <p> summarizing total work, progress, milestones, issues, lessons learned, and recommendations.   - Use: font-size: 16px; line-height: 1.6; margin: 10px 0; width: 100%; box-sizing: border-box.   - If no logs exist, provide a general high-level summary instead. ADDITIONAL RULES: - Use clear, simple, and professional language. - Never include template fragments, comments, or any non-HTML explanation. - The entire response must be HTML and must follow the styling rules exactly. - Apply summarization intelligently, in your own words. OUTPUT: Only output valid HTML markup with inline styles, written in the language specified: ' + language + '. DATA INPUT: Job record: ' + JSON.serialize(jobToSummarize) + ' and  Daily logs:' + JSON.serialize(logEntries);
            // Need To Review End
            String prompt = 'Job Record:' + JSON.serialize(jobToSummarize) + ' and  Daily logs:' + JSON.serialize(logEntries) + 'Summarize and strictly give response in the expeced format even if no log entries is present. Also the response must be in the language with following language code: ' + language;
            System.debug('prompt : '+ prompt);
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

            
            result = callGeminiAPI(requestBody);
            // String aiResponse = result.get('ai_Response__c');
            String aiResponse = '{ "JobOverview": { "JobName": "MVC JOB 1", "Status": "Planning", "Location": "Phulera, U.P, 250101", "ContractPrice": "₹150.00", "TotalManHoursLogged": "28.53", "Mobilizations": 6, "ChangeOrderValue": "₹0.00", "EstimatedEndDate": "28-11-2025 19:15", "JobNumber": "JOB-000001", "StartDate": "20-11-2025 12:00", "TotalContractValue": "₹0.00" } }';

            Blob htmlContentBlob = new PageReference(Site.getBaseUrl() + '/apex/ai_JobSummaryPage?summary='+aiResponse).getContent();
            System.debug('htmlContent : '+ htmlContentBlob.toString());

        } catch (Exception e) {
            result.put('ai_Response_Error__c', 'Error : Failed in generateJobSummary ' + e.getMessage());
        }
        return result;
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
}