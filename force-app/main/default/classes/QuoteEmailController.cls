public with sharing class QuoteEmailController {

    public class InitData {
        @AuraEnabled public List<OrgWideEmailAddress> orgWideAddresses;
        @AuraEnabled public List<EmailTemplate> emailTemplates;
    }

    @AuraEnabled(cacheable=true)
    public static InitData getInitialData() {
        InitData data = new InitData();
        data.orgWideAddresses = [SELECT Id, Address, DisplayName FROM OrgWideEmailAddress];
        data.emailTemplates = [
            SELECT Id, Name 
            FROM EmailTemplate 
            WHERE IsActive = true 
            AND Folder.Name = 'Quote Emails' 
            ORDER BY Name 
            LIMIT 100
        ];
        return data;
    }

    @AuraEnabled
    public static Map<String, String> renderEmailTemplate(String templateId, String whoId, String whatId) {
        if(String.isBlank(templateId)) return null;

        // If user hasn't selected "To" yet, pick a dummy contact to allow preview rendering
        if(String.isBlank(whoId)) {
            List<Contact> dummy = [SELECT Id FROM Contact LIMIT 1];
            if(!dummy.isEmpty()) whoId = dummy[0].Id;
        }

        try {
            Messaging.SingleEmailMessage mail = Messaging.renderStoredEmailTemplate(templateId, whoId, whatId);
            Map<String, String> result = new Map<String, String>();
            result.put('subject', mail.getSubject());
            result.put('body', mail.getHtmlBody());
            return result;
        } catch (Exception e) {
            throw new AuraHandledException('Error rendering template: ' + e.getMessage());
        }
    }

    /**
     * Updated to accept file attachments
     * files parameter structure: List of Maps { 'fileName': '...', 'base64Data': '...', 'contentType': '...' }
     */
    @AuraEnabled
    public static void sendQuoteEmail(
        String toId, 
        List<String> ccIds, 
        List<String> bccIds, 
        String subject, 
        String body, 
        String fromId, 
        String relatedToId,
        List<Object> files 
    ) {
        try {
            Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
            
            // Set Target (To)
            if(String.isNotBlank(toId)) {
                mail.setTargetObjectId(toId);
                mail.setTreatTargetObjectAsRecipient(true);
            }

            // Set Related Record
            if(String.isNotBlank(relatedToId)) {
                mail.setWhatId(relatedToId);
            }

            // Set From Address
            if(String.isNotBlank(fromId)) {
                mail.setOrgWideEmailAddressId(fromId);
            }

            // Set CC & BCC
            if(ccIds != null && !ccIds.isEmpty()) {
                mail.setCcAddresses(getEmailsFromIds(ccIds));
            }
            if(bccIds != null && !bccIds.isEmpty()) {
                mail.setBccAddresses(getEmailsFromIds(bccIds));
            }

            mail.setSubject(subject);
            mail.setHtmlBody(body);
            mail.setSaveAsActivity(true);

            // --- Handle Attachments ---
            if (files != null && !files.isEmpty()) {
                List<Messaging.EmailFileAttachment> attachments = new List<Messaging.EmailFileAttachment>();
                
                for (Object fileObj : files) {
                    Map<Object, Object> fileMap = (Map<Object, Object>)fileObj;
                    String fileName = (String)fileMap.get('fileName');
                    String base64Data = (String)fileMap.get('base64Data');
                    String contentType = (String)fileMap.get('contentType');

                    Messaging.EmailFileAttachment efa = new Messaging.EmailFileAttachment();
                    efa.setFileName(fileName);
                    efa.setBody(EncodingUtil.base64Decode(base64Data));
                    efa.setContentType(contentType);
                    attachments.add(efa);
                }
                mail.setFileAttachments(attachments);
            }

            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{mail});

        } catch (Exception e) {
            throw new AuraHandledException('Error sending email: ' + e.getMessage());
        }
    }

    // Helper to get emails from Contact IDs
    private static List<String> getEmailsFromIds(List<String> recordIds) {
        List<String> emails = new List<String>();
        for(Contact c : [SELECT Email FROM Contact WHERE Id IN :recordIds]) {
            if(c.Email != null) emails.add(c.Email);
        }
        return emails;
    }
}