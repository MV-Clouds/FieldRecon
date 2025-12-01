public with sharing class JobSummaryAI_Queue implements Queueable, Database.AllowsCallouts {
    
    public Map<String, String> params = new Map<String, String>();

    public JobSummaryAI_Queue(Map<String, String> params) {
        this.params = params;
    }

    public void execute(QueueableContext context) {
        try {
            String jobId = params.get('jobId');
            if(String.isNotBlank(jobId)){
                generateJobSummary_Async(jobId);
            }
            else if(String.isNotBlank(params.get('jobSummaryId'))){
                getSummaryAsHtml(params.get('jobSummaryId'));
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobSummaryAI_Queue' , 'methodName' => 'execute', 'exceptionObj' => e, 'moreDetails' => 'Error occurred during job summary generation in queueable'});
        }
    }

    public static void generateJobSummary_Async(String JobId){
        try {
            Map<String, Object> params = new Map<String, Object>{
                'jobId' => JobId,
                'language' => 'English (en)',
                'durationType' => 'all',
                'avoidHtmlContent' => true
            };
            Map<String,Object> ai_result = AICalloutController.generateJobSummary(JSON.serialize(params)); 

            // Store Ai response info in Job Summary Object
            Job_Summary_AI__c jobSummary = new Job_Summary_AI__c();
            jobSummary.Job__c = JobId;
            if(String.isNotBlank((String) ai_result?.get('ai_Response_Error__c'))){
                jobSummary.Remark__c = (String) ai_result?.get('ai_Response_Error__c');
            } else {
                jobSummary.Summary_Data_Raw__c = (String) ai_result?.get('ai_Response__c');
                jobSummary.Remark__c = 'This Job Summary Generation after Job Status updated to "closed".';
            }
            insert as user jobSummary;

            System.enqueueJob(new JobSummaryAI_Queue(new Map<String, String>{'jobSummaryId' => jobSummary.Id}));

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobTriggerHandler' , 'methodName' => 'generateJobSummary_Async', 'exceptionObj' => e, 'moreDetails' => 'Error occurred during job summary generation in "@future"'});
        }
    }

    public static void getSummaryAsHtml(String jobSummaryId){
        try {
            Map<String, Object> ai_result = AICalloutController.getSummaryAsHtml(jobSummaryId);
            // Process the HTML content as needed
            
            String htmlContent = (String) ai_result.get('htmlContent');

            if(String.isNotBlank(htmlContent)){
                // Further processing of HTML content
                String styleTag = htmlContent.subStringBetween('<style>', '</style>');
                Job_Summary_AI__c jobSummary = new Job_Summary_AI__c(
                    Id = jobSummaryId,
                    Job_Summary_Preview__c = htmlContent.replace('<style>'+styleTag+'</style>', ''),
                    Summary_Data_HTML__c = htmlContent
                );
                update as user jobSummary;
            }

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobSummaryAI_Queue' , 'methodName' => 'getSummaryAsHtml', 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching job summary as HTML'});
        }
    }
}