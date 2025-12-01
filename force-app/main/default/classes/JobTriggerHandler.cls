public with sharing class JobTriggerHandler {

    public static void createDefaultLocations(List<wfrecon__Job__c> newJobs) {

        try{
            List<wfrecon__Location__c> locationsToInsert = new List<wfrecon__Location__c>();
            List<wfrecon__Job__c> jobsToUpdate = new List<wfrecon__Job__c>();

            for (wfrecon__Job__c job : newJobs) {

                if (job == null) {
                    continue;
                }

                wfrecon__Location__c loc = new wfrecon__Location__c();
                loc.Name = 'Job Site';
                loc.wfrecon__Quantity__c = 1;
                loc.wfrecon__Job__c = job.Id;
                locationsToInsert.add(loc);

                wfrecon__Job__c jobToUpdate = new wfrecon__Job__c(Id = job.Id);
                jobToUpdate.wfrecon__Job_Number__c = job.Name;
                jobsToUpdate.add(jobToUpdate);
            }

            if (!locationsToInsert.isEmpty()) {
                insert locationsToInsert;
            }

            if (!jobsToUpdate.isEmpty()) {
                update jobsToUpdate;
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobTriggerHandler' , 'methodName' => 'createDefaultLocations', 'exceptionObj' => e, 'moreDetails' => 'Error occurred during creation of location record from job trigger', 'apiResponse' => null});
        }

    }



    public static void generateJobSummary(List<wfrecon__Job__c> newJobs, Map<Id, wfrecon__Job__c> oldJobsMap){
        try {
            for(wfrecon__Job__c job : newJobs){
                if(job.wfrecon__Status__c == 'Closed' && oldJobsMap.get(job.Id).wfrecon__Status__c != 'Closed'){
                    // generateJobSummary_Async(job.Id);
                    System.enqueueJob(new JobSummaryAI_Queue(new Map<String, String>{'jobId' => job.Id}));
                }
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobTriggerHandler' , 'methodName' => 'generateJobSummary', 'exceptionObj' => e, 'moreDetails' => 'Error occurred during job summary generation from job trigger'});
        }
    }

    @future(callout=true)
    public static void generateJobSummary_Async(String JobId){
        try {
            Map<String, String> params = new Map<String, String>{
                'jobId' => JobId,
                'language' => 'English (en)',
                'durationType' => 'all'
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
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobTriggerHandler' , 'methodName' => 'generateJobSummary_Async', 'exceptionObj' => e, 'moreDetails' => 'Error occurred during job summary generation in "@future"'});
        }
    }
}