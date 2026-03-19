public with sharing class ProposalTemplatePDFController {
    @AuraEnabled
    public static Blob generatePDFBlob(String recordId, String templateId, String contactId) {
        try {
            // Generate the PDF URL
            String pdfUrl = '/apex/ProposalTemplatePDF?recordId=' + recordId + '&templateId=' + templateId;
            
            if (String.isNotBlank(contactId)) {
                pdfUrl += '&contactId=' + contactId;
            }
            
            // Use PageReference to get content as PDF
            PageReference pdfPage = new PageReference(pdfUrl);
            
            // Get the PDF content as blob
            Blob pdfBlob;
            if (Test.isRunningTest()) {
                pdfBlob = Blob.valueOf('Test PDF Content');
            } else {
                pdfBlob = pdfPage.getContentAsPDF();
            }
            return pdfBlob;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ProposalTemplatePDFController', 'methodName' => 'generatePDFBlob', 'exceptionObj' => e, 'moreDetails' => e.getMessage()});
            throw new AuraHandledException('Error generating PDF blob: ' + e.getMessage());
        }
    }
}