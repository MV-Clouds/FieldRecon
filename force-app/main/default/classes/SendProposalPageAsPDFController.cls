public with sharing class SendProposalPageAsPDFController {
    public String recordID { get; set; }
    public String contactId { get; set; }
    public String strBody { get; set; }
    public String templateId { get; set; }

    public void createPDF() {
        try {
            // Get Parameters
            recordID = ApexPages.currentPage().getParameters().get('recordId');
            templateId = ApexPages.currentPage().getParameters().get('templateId');
            contactId = ApexPages.currentPage().getParameters().get('contactId');

            if(String.isBlank(templateId) || String.isBlank(recordID)) {
                strBody = 'Error: Missing Template Id or Record Id';
                return;
            }

            // Fallback for Contact ID (Required for Email Template rendering)
            if(String.isBlank(contactId)) {
                List<wfrecon__Proposal__c> prop = [SELECT wfrecon__Contact__c FROM wfrecon__Proposal__c WHERE Id = :recordID LIMIT 1];
                if(!prop.isEmpty()) {
                    contactId = prop[0].wfrecon__Contact__c;
                }
                // If still null, fetch a dummy contact to allow rendering
                if(String.isBlank(contactId)) {
                    List<Contact> dummy = [SELECT Id FROM Contact LIMIT 1];
                    if(!dummy.isEmpty()) contactId = dummy[0].Id;
                }
            }

            // --- THE ROLLBACK TRICK ---
            Savepoint sp = Database.setSavepoint();
            
            Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
            email.setTemplateId(templateId);
            email.setWhatId(recordID);
            email.setTargetObjectId(contactId);
            email.setSaveAsActivity(false);
            email.setToAddresses(new List<String>{'dummy@example.com'});

            // Send email (This generates the body)
            Messaging.SendEmailResult[] results = Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{email});
            
            // Rollback (Undo the send, but keep the object in memory)
            Database.rollback(sp);

            if (!results.isEmpty() && results[0].isSuccess()) {
                String rawHtml = email.getHTMLBody();
                
                // --- LOGIC CHANGE HERE ---
                // Regex to find the <img src="{SIGNATURE_PLACEHOLDER}" ... /> tag and remove it entirely
                // This matches <img followed by anything until src="{SIGNATURE_PLACEHOLDER}" followed by anything until the closing >
                if(rawHtml != null) {
                    strBody = rawHtml.replaceAll('<img[^>]+src=["\']\\{SIGNATURE_PLACEHOLDER\\}["\'][^>]*>', '');
                } else {
                    strBody = '';
                }

            } else {
                strBody = 'Error: Failed to generate template content. Errors: ' + results[0].getErrors();
            }      
            
        } catch (Exception e) {
            System.debug('PDF Gen Error: ' + e.getMessage());
            strBody = 'Error: ' + e.getMessage();
        }
    }
}