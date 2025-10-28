public with sharing class EmailTemplateController {
    
    /**
     * Fetches the HTML body from an EmailTemplate by Name
     * @param templateName - The Name or DeveloperName of the EmailTemplate
     * @param recordId - The Id of the record to merge fields (optional)
     * @return String - The HTML body of the email template
     */
    @AuraEnabled
    public static Map<String,String> getEmailTemplateBody(String recordId) {
        Map<String,String> result = new Map<String,String>();
        try {
            PageReference pageRef = Page.BillingPDF;
            pageRef.getParameters().put('renderAsPDF', 'false');
            String htmlBody = !Test.isRunningTest() ? pageRef.getContent().toString() : '<div>Test HTML</div>';

            result.put('body', htmlBody);

            List<wfrecon__Billing__c> billings = [SELECT Id, Name FROM wfrecon__Billing__c WHERE Id = :recordId WITH USER_MODE LIMIT 1];
            if (!billings.isEmpty()) {
                wfrecon__Billing__c billing = billings[0];
                result.put('billingName', billing.Name);
            }

            return result;

        } catch (Exception e) {
            throw new AuraHandledException('Error fetching email template: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static String getVFPagePDF(String recordId) {
        try {
            PageReference pageRef = Page.BillingPDF;
            pageRef.getParameters().put('renderAsPDF', 'true');
            Blob pdfBlob = !Test.isRunningTest() ? pageRef.getContentAsPDF() : Blob.valueOf('Test PDF');
            String base64Pdf = EncodingUtil.base64Encode(pdfBlob);
            
            return base64Pdf;
        } catch (Exception e) {
            System.debug('Error in getVFPagePDF: ' + e.getMessage());
            throw new AuraHandledException('Failed to generate PDF: ' + e.getMessage());
        }
    }
}