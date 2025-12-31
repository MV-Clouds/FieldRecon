public with sharing class QuoteEmailController {

    public class InitData {
        @AuraEnabled public List<OrgWideEmailAddress> orgWideAddresses;
        @AuraEnabled public List<EmailTemplate> emailTemplates;
    }

    @AuraEnabled(cacheable=true)
    public static InitData getInitialData() {
        InitData data = new InitData();
        // Fetch Org Wide Addresses
        data.orgWideAddresses = [SELECT Id, Address, DisplayName FROM OrgWideEmailAddress];
        
        // Fetch Email Templates from specific folder "Quote Emails"
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

        // Messaging.renderStoredEmailTemplate requires a valid WhoId (Contact/Lead)
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

    @AuraEnabled
    public static void sendQuoteEmail(
        String toId, 
        List<String> ccIds, 
        List<String> bccIds, 
        String subject, 
        String body, 
        String fromId, 
        String relatedToId
    ) {
        try {
            Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
            
            // Set Target (To)
            if(String.isNotBlank(toId)) {
                mail.setTargetObjectId(toId);
                mail.setTreatTargetObjectAsRecipient(true); // Sends to the Contact
            }

            // Set Related Record
            if(String.isNotBlank(relatedToId)) {
                mail.setWhatId(relatedToId);
            }

            // Set From Address (Org Wide)
            if(String.isNotBlank(fromId)) {
                mail.setOrgWideEmailAddressId(fromId);
            }

            // Set CC
            if(ccIds != null && !ccIds.isEmpty()) {
                mail.setCcAddresses(getIdsFromStrings(ccIds)); // Requires converting IDs to emails usually, but CC on object requires logic
                // NOTE: setCcAddresses expects String[] of emails. 
                // For IDs, we usually fetch emails. Simple version here:
                mail.setCcAddresses(getEmailsFromIds(ccIds));
            }

            // Set BCC
            if(bccIds != null && !bccIds.isEmpty()) {
                mail.setBccAddresses(getEmailsFromIds(bccIds));
            }

            mail.setSubject(subject);
            mail.setHtmlBody(body);
            mail.setSaveAsActivity(true);

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
    
    private static List<String> getIdsFromStrings(List<String> inputs) {
        return inputs;
    }
}