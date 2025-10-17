public with sharing class BillingPDFController {
    public Boolean isRenderAsPDF { get; set; }

    public BillingPDFController() {
        String renderMode = ApexPages.currentPage().getParameters().get('renderAsPDF');
        isRenderAsPDF = (renderMode == 'true');
    }
}