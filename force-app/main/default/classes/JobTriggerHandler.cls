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
}