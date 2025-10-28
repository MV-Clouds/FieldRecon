public with sharing class ScheduleSetupController {
    @AuraEnabled
    public static ScheduleSetupWrapper getScheduleSetup() {
            ScheduleSetupWrapper setupWrapper = new ScheduleSetupWrapper();
            setupWrapper.mobilizationStatuses = ScheduleSetupService.getMobilizationStatuses();
            setupWrapper.assetTypes = ScheduleSetupService.getAssetTypeVehicle();
            List<Job_Default_Times__c> jobDefaultTimes = Job_Default_Times__c.getall().values();
            if (jobDefaultTimes.size() == 0) {
                jobDefaultTimes.add(new Job_Default_Times__c());
            }
            setupWrapper.startTime = jobDefaultTimes[0].Start_Time__c;
            setupWrapper.endTime = jobDefaultTimes[0].End_Time__c;

            return setupWrapper;
    }

    @AuraEnabled
    public static void saveScheduleSetup(ScheduleSetupWrapper setupWrapper) {
        List<Mobilization_Status_Color__c> updateListStatusColor = new List<Mobilization_Status_Color__c>();
            for (ColorStatusWrapper scw : setupWrapper.mobilizationStatuses) {
                Mobilization_Status_Color__c objmsc = new Mobilization_Status_Color__c();
                objmsc.Name = scw.Status;
                objmsc.id = scw.settingId;
                objmsc.Background_Color__c = scw.backgroundColor;
                objmsc.Color__c = scw.textColor;
                updateListStatusColor.add(objmsc);
            }

            for (ColorStatusWrapper scw : setupWrapper.assetTypes) {
                Mobilization_Status_Color__c objmsc = new Mobilization_Status_Color__c();
                objmsc.Name = scw.Status;
                objmsc.id = scw.settingId;
                objmsc.Background_Color__c = scw.backgroundColor;
                objmsc.Color__c = scw.textColor;
                updateListStatusColor.add(objmsc);
            }

            List<Job_Default_Times__c> jobDefaultTimes = Job_Default_Times__c.getall().values();
            if (jobDefaultTimes.size() == 0) {
                jobDefaultTimes.add(new Job_Default_Times__c());
                jobDefaultTimes[0].Name = 'Default Times';
            }
            jobDefaultTimes[0].Start_Time__c = setupWrapper.startTime;
            jobDefaultTimes[0].End_Time__c = setupWrapper.endTime;

            Lib_Security.ws().dbUpsert(jobDefaultTimes);
            Lib_Security.ws().dbUpsert(updateListStatusColor);
    }
}