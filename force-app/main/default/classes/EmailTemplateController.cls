public with sharing class EmailTemplateController {
    
    /**
     * Fetches the HTML body from an EmailTemplate by Name
     * @param templateName - The Name or DeveloperName of the EmailTemplate
     * @param recordId - The Id of the record to merge fields (optional)
     * @return String - The HTML body of the email template
     */
    @AuraEnabled
    public static Map<String,String> getEmailTemplateBody(String templateName, String recordId) {
        Map<String,String> result = new Map<String,String>();
        try {
            if (String.isBlank(templateName)) {
                throw new AuraHandledException('Template name is required');
            }
            
            // Query the EmailTemplate by Name or DeveloperName
            List<EmailTemplate> templates = [SELECT Id, DeveloperName, Subject, HtmlValue, Body, Markup FROM EmailTemplate WHERE Name = :templateName WITH USER_MODE LIMIT 1];
            
            if (templates.isEmpty()) {
                throw new AuraHandledException('Email template not found: ' + templateName);
            }
            
            EmailTemplate template = templates[0];
            String htmlBody = '';
            
            // Get the HTML body or fallback to plain text
            if (String.isNotBlank(template.HtmlValue)) {
                htmlBody = template.HtmlValue;
            } else if (String.isNotBlank(template.Markup)) {
                htmlBody = template.Markup;
            } else if (String.isNotBlank(template.Body)) {
                htmlBody = '<div>' + template.Body + '</div>';
            }

            result.put('body', htmlBody);

            List<wfrecon__Billing__c> billings = [SELECT Id, Name FROM wfrecon__Billing__c WHERE Id = :recordId WITH USER_MODE LIMIT 1];
            if (!billings.isEmpty()) {
                wfrecon__Billing__c billing = billings[0];
                result.put('billingName', billing.Name);
            }

            return result;

            // If recordId is provided, merge fields
            // if (String.isNotBlank(recordId) && String.isNotBlank(htmlBody)) {
            //     htmlBody = mergeTemplateFields(htmlBody, recordId);
            // }

        } catch (Exception e) {
            throw new AuraHandledException('Error fetching email template: ' + e.getMessage());
        }
    }
}
