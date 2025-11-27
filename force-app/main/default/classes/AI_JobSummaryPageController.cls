public with sharing class AI_JobSummaryPageController {

    public static String summaryData  {get;set;}

    public AI_JobSummaryPageController() {
        if(ApexPages.currentPage().getParameters().get('summary') != null){
            summaryData = ApexPages.currentPage().getParameters().get('summary');
        }
    }
}