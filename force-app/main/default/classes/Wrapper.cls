public with sharing class Wrapper {
    public class MobilizationGroup {
        @AuraEnabled
        public String id{get;set;}
        @AuraEnabled
        public String name{get;set;}
        @AuraEnabled
        public Datetime startDate{get;set;}
        @AuraEnabled
        public Datetime endDate{get;set;}
        @AuraEnabled
        public String jobId{get;set;}
        @AuraEnabled
        public String jobName{get;set;}
        @AuraEnabled
        public String description{get;set;}
        @AuraEnabled
        public String jobRealName{get;set;}
        @AuraEnabled
        public Boolean includeSaturday{get;set;}
        @AuraEnabled
        public Boolean includeSunday{get;set;}
        @AuraEnabled
        public String status{get;set;}

        public MobilizationGroup() {}

        public MobilizationGroup(Mobilization_Group__c mobGroup) {
            this.id = mobGroup.Id;
            this.name = mobGroup.Name;
            /*Datetime localTime = mobGroup.Start_Date__c.Date();
         
            localTime = localTime.addHours(mobGroup.Start_Date__c.hour());
            localTime = localTime.addMinutes(mobGroup.Start_Date__c.minute());
            localTime = localTime.addSeconds(mobGroup.Start_Date__c.second());
            
            this.startDate = localTime;//mobGroup.Start_Date__c;*/
            this.startDate = mobGroup.Start_Date__c;
            this.endDate = mobGroup.End_Date__c;
            this.jobId = mobGroup.Job__c;
            this.jobRealName = mobGroup.job__r?.Job_Name__c;
            this.jobName = mobGroup.Job__r?.Name;
            this.status = mobGroup.Mobilization_Status__c;
            this.description = mobGroup.Description__c;
            this.includeSaturday = mobGroup.Include_Saturday__c;
            this.includeSunday = mobGroup.Include_Sunday__c;
        }

        public Mobilization_Group__c getMobilizationGroupSObject() {
            return new Mobilization_Group__c(
                Id = this.id,
                Start_Date__c = this.startDate,
                End_Date__c = this.endDate,
                Job__c = this.jobId,
                Include_Saturday__c = this.includeSaturday,
                Include_Sunday__c = this.includeSunday,
                Mobilization_Status__c = this.status,
                Description__c = this.description
            );
        }

    }
}