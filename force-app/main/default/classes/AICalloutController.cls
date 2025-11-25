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
    public static String getTranscript(String audioData) {
        try {
            String apiKey = System.Label.Gemini_Api_Key;
            String model = 'gemini-2.0-flash';

            String endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

            // Prepare request
            HttpRequest req = new HttpRequest();
            req.setEndpoint(endpoint);
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');

            
            // Escape prompt safely using JSON.serialize
            // String promptJson = JSON.serialize(prompt);

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
            // data.put('data', audioData?.substringAfter('base64,'));
            data.put('data', audioData);
            String prompt = JSON.serialize(data);
            System.debug('prompt : '+prompt);

            // Build full request body using content structure
            String requestBody = createPrompt(userPrompt, prompt);
            req.setBody(requestBody);
            req.setTimeout(120000);

            // System.debug('requestBody : '+requestBody);

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
                                    return (String) firstPart.get('text');
                                }
                            }
                        }
                    }
                }
            } else {
                System.debug('Gemini API Error - Status: ' + res.getStatusCode() + ', Body: ' + res.getBody());
                // sendemail(res.getBody(), 'Gemini API Error');
                // callGeminiAPI(prompt);
            }
        } catch (Exception e) {
            System.debug('Error in callGeminiAPI: ' + e.getMessage() + ' at line ' + e.getLineNumber());
            // sendemail(e.getMessage(), 'Apex Exception');
        }
        return 'Error : Failed to get response from Gemini API.';
    }

    public static string createPrompt(String userPrompt, string audioData){
        return '{' + 
                '"contents": [' + 
                    '{' + 
                        '"parts": [' + 
                            '{"text": "' + userPrompt + '"},' +
                            '{"inline_data": ' + audioData + '}' +
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
    }
}