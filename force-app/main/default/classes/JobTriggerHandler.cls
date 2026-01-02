public with sharing class JobTriggerHandler {

    public static void createDefaultLocations(List<Job__c> newJobs) {

        try{
            List<Location__c> locationsToInsert = new List<Location__c>();
            List<Job__c> jobsToUpdate = new List<Job__c>();

            for (Job__c job : newJobs) {

                if (job == null) {
                    continue;
                }

                Location__c loc = new Location__c();
                loc.Name = 'Job Site';
                loc.Quantity__c = 1;
                loc.Job__c = job.Id;
                locationsToInsert.add(loc);

                Job__c jobToUpdate = new Job__c(Id = job.Id);
                jobToUpdate.Job_Number__c = job.Name;
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

    public static void handleAfter(
        List<wfrecon__Job__c> newList,
        List<wfrecon__Job__c> oldList,
        Boolean isUpdate,
        Boolean isDelete
    ) {
        List<Job_Change_Event__e> events = new List<Job_Change_Event__e>();

        try{
        if (isDelete && oldList != null) {
            for (wfrecon__Job__c job : oldList) {
                events.add(new Job_Change_Event__e(
                    Job_Id__c = job.Id,
                    Operation_Type__c = 'DELETE'
                ));
            }
        }

        if (isUpdate && newList != null) {
            for (wfrecon__Job__c job : newList) {
                events.add(new Job_Change_Event__e(
                    Job_Id__c = job.Id,
                    Operation_Type__c = 'UPDATE'
                ));
            }
        }

        if (!events.isEmpty()) {
            EventBus.publish(events);
        }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobTriggerHandler' , 'methodName' => 'handleAfter', 'exceptionObj' => e, 'moreDetails' => '', 'apiResponse' => null});
        }
    }


}