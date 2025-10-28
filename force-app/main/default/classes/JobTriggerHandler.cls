public with sharing class JobTriggerHandler {

    public static void createDefaultLocations(List<Job__c> newJobs) {

        try{
            List<Location__c> locationsToInsert = new List<Location__c>();

            for (Job__c job : newJobs) {

                if (job == null || job.Job_Name__c == '') {
                    continue;
                }

                Location__c loc = new Location__c();
                loc.Name = 'Job Site';
                loc.Quantity__c = 1;
                loc.Job__c = job.Id;
                locationsToInsert.add(loc);
            }

            if (!locationsToInsert.isEmpty()) {
                insert as user locationsToInsert;
            }        
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobTriggerHandler' , 'methodName' => 'createDefaultLocations', 'exceptionObj' => e, 'moreDetails' => 'Error occurred during creation of location record from job trigger', 'apiResponse' => null});
        }

    }
}