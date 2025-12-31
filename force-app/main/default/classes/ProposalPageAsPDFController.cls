public without sharing class ProposalPageAsPDFController {
    public String recordID { get; set; }
    public String contactId { get; set; }
    public String imgId { get; set; }
    public String strBody { get; set; }
    public String templateId { get; set; }

    public void createPDF() {
        try {
            recordID = ApexPages.currentPage().getParameters().get('Id');
            templateId = ApexPages.currentPage().getParameters().get('templateId');
            imgId = ApexPages.currentPage().getParameters().get('imgURL');
            contactId = ApexPages.currentPage().getParameters().get('contactId');

            // Generate email template body
            Savepoint sp = Database.setSavepoint();
            Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
            email.setTemplateId(templateId);
            email.setWhatId(recordID);
            email.setTargetObjectId(contactId);
            email.setSaveAsActivity(false);
            email.setToAddresses(new List<String>{'dummy@example.com'});

            Messaging.SendEmailResult[] results = Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{email});
            Database.rollback(sp);

            if (!results.isEmpty() && results[0].isSuccess()) {
                strBody = email?.getHTMLBody()?.replace('{SIGNATURE_PLACEHOLDER}', imgId);
            } else {
                strBody = 'Error: Failed to generate template content. Errors: ' + results[0].getErrors();
            }      
            
        } catch (Exception e) {
            strBody = 'Error: ' + e.getMessage() + ' at line: ' + e.getLineNumber();
        }
    }
}